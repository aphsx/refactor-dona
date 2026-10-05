"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { PlantingActivityPanel } from "@/components/activities-screen";
import { CanAdd, CanDelete, CanEdit } from "@/components/can";
import { PlanEditor } from "@/components/plan-editor";
import { useMill } from "@/components/store";
import { DateField, Dialog, DirtyUndoButton, FarmerSelect, Glyph, PageHeader, Pagination, PrimaryButton, SecondaryButton, SearchSelect, Select, SortableTh, StatusTab, SuggestInput, ConfirmAlert, ResultAlert, TableScroll, inputClass, matchesQuery, openRow, orderBy, rowTone, tableClass, usePagination, useTableSort } from "@/components/ui";
import { api, collectPages, measureRingAreaRai } from "@/lib/api";
import { useServerPage } from "@/components/server-page";
import type { FieldMapHandle } from "@/components/field-map";
import { centroid, closeRing, currentActivityStage, currentPlanting, daysUntil, defaultProductKindId, defaultVarietyId, farmerHandle, farmerName, farmerVarieties, formatCoord, formatKg, formatRai, formatThaiDate, isClosedRing, millReceiptDirectionLabel, openPlanting, openRing, personRole, plantingAreaSummary, plantingsOf, productKindName, roleTitle, varietyName, type Farmer, type MillReceipt, type MillReceiptDirection, type Planting, type Plot, type PlotActivity, type ProductKind, type SupplierGroup, type Variety } from "@/lib/mill";
import { districtOptions, isCompletePlace, placeAt, placeCenter, placeLabel, provinceOptions, subdistrictOptions, type PlaceIds } from "@/lib/thai-place";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });
const PlotDetail = dynamic(() => import("@/components/plot-detail").then((mod) => mod.PlotDetail), { ssr: false });

/** Flip on when rolling out plot tabs under farmer manage. */
const SHOW_MEMBER_PLOT_TABS = true;
/** Flip on when rolling out planting-plan tabs under farmer manage. */
const SHOW_MEMBER_PLAN_TABS = false;
/** Flip on when rolling out receipt standing + mill ledger under farmer detail. */
const SHOW_MEMBER_RECEIPT_SECTIONS = false;

type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string; done?: () => void };

function NoticeBox({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  if (!notice) return null;
  if (notice.tone === "confirm") {
    return <ConfirmAlert message={notice.message} onCancel={onDismiss} onConfirm={notice.accept} />;
  }
  return (
    <ResultAlert
      kind={notice.tone}
      message={notice.message}
      onClose={() => {
        notice.done?.();
        onDismiss();
      }}
    />
  );
}

async function reported(error: Promise<string | null> | string | null, success: string, done?: () => void): Promise<Notice> {
  const message = await error;
  return message ? { tone: "error", message } : { tone: "success", message: success, done };
}

export function GroupsScreen() {
  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="กลุ่ม" />
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <GroupDirectory />
      </div>
    </div>
  );
}

export function GroupManageScreen() {
  const { groups, createGroup } = useMill();
  const router = useRouter();
  const requestedId = useSearchParams().get("group");
  const requested = groups.some((group) => group.id === requestedId) ? requestedId : null;
  const [tab, setTab] = useState<"listing" | "detail">(requested ? "detail" : "listing");
  const [draftName, setDraftName] = useState("");
  const [draftLeader, setDraftLeader] = useState("");
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requested);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const selected = groups.find((group) => group.id === selectedId) ?? null;

  const rows = useMemo(() => {
    return groups.filter((group) => {
      if (!matchesQuery(name, group.name)) return false;
      if (leaderId && group.leaderId !== leaderId) return false;
      return true;
    });
  }, [groups, name, leaderId]);
  const listingSort = useTableSort(`${name}:${leaderId}`);
  const ordered = orderBy(rows, listingSort.sort, (group, key) => {
    if (key === "name") return group.name;
    if (key === "leader") return group.leaderName ?? "";
    if (key === "members") return group.memberCount ?? 0;
    if (key === "received") return group.receivedKg ?? 0;
    return group.expectedKg ?? 0;
  });
  const page = usePagination(ordered, `${name}:${leaderId}`);

  function openGroup(id: string) {
    setSelectedId(id);
    setTab("detail");
    router.replace(`/groups/manage?group=${id}`);
  }

  function closeDetail() {
    setSelectedId(null);
    setTab("listing");
    router.replace("/groups/manage");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการกลุ่ม" />
      <div className="flex items-end gap-1">
        <StatusTab label="กลุ่ม" active={tab === "listing"} onClick={closeDetail} />
        {tab === "detail" && selected && (
          <StatusTab label="รายละเอียดกลุ่ม" active onClick={() => setTab("detail")} />
        )}
      </div>
      {tab === "listing" && (
        <div className="mb-6 overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหากลุ่ม</div>
          <form
            className="grid gap-4 px-6 py-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setName(draftName);
              setLeaderId(draftLeader);
            }}
          >
            <label className="block text-[14px] font-bold leading-[1.4]">
              ชื่อกลุ่ม
              <SuggestInput
                label="ชื่อกลุ่ม"
                className="mt-1"
                value={draftName}
                onChange={setDraftName}
                suggestions={[...groups].sort((a, b) => a.name.localeCompare(b.name, "th")).map((group) => group.name)}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              หัวหน้ากลุ่ม
              <div className="mt-1">
                <FarmerSelect allowAll value={draftLeader} onChange={setDraftLeader} />
              </div>
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <PrimaryButton type="submit">
                <Glyph icon={Search} />
                ค้นหา
              </PrimaryButton>
              <PrimaryButton
                type="button"
                onClick={() => {
                  setDraftName("");
                  setDraftLeader("");
                  setName("");
                  setLeaderId("");
                }}
              >
                <Glyph icon={RotateCcw} />
                ล้าง
              </PrimaryButton>
              <CanAdd resource="groups">
                <SecondaryButton onClick={() => setCreatingGroup(true)}>
                  <Glyph icon={Plus} />
                  สร้างกลุ่ม
                </SecondaryButton>
              </CanAdd>
            </div>
          </form>
        </div>
      )}
      <div className={`overflow-hidden border border-frame ${tab === "listing" ? "rounded-[8px]" : "rounded-b-[8px] rounded-tr-[8px]"}`}>
        {tab === "listing" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
              รายการกลุ่ม
              <span className="text-[14px] font-normal">{page.total || groups.length} กลุ่ม</span>
            </div>
            <TableScroll>
            <table className={tableClass}>
              <thead className="bg-table">
                <tr>
                  <SortableTh label="กลุ่ม" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="หัวหน้า" column="leader" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="สมาชิก" column="members" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="คาดว่าจะได้" column="expected" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="รับเข้าโรงสี" column="received" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {page.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-ink/60">
                      ไม่พบกลุ่ม
                    </td>
                  </tr>
                )}
                {page.rows.map((group, index) => (
                    <tr key={group.id} onClick={(event) => openRow(event, () => openGroup(group.id))} className={rowTone(index)}>
                      <td className="px-5 py-3 font-bold">{group.name}</td>
                      <td className="px-5 py-3">{group.leaderName || "—"}</td>
                      <td className="px-5 py-3">{group.memberCount ?? 0}</td>
                      <td className="px-5 py-3">{formatKg(group.expectedKg ?? 0)}</td>
                      <td className="px-5 py-3">{formatKg(group.receivedKg ?? 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </TableScroll>
            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              onPageChange={page.setPage}
              onPageSizeChange={page.setPageSize}
            />
          </>
        )}
        {tab === "detail" && selected && <GroupDetail group={selected} onClose={closeDetail} />}
      </div>
      {creatingGroup && <CreateGroup onClose={() => setCreatingGroup(false)} onCreate={createGroup} />}
    </div>
  );
}

export function MemberManageScreen() {
  const { groups, roleGrants, assignFarmer, revision, farmerPage } = useMill();
  const router = useRouter();
  const requestedId = useSearchParams().get("farmer");
  const requested = requestedId;
  const [tab, setTab] = useState<"listing" | "detail" | "plots" | "plan">(requested ? "detail" : "listing");
  const [draftName, setDraftName] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [detailId, setDetailId] = useState<string | null>(requested);
  const [planPlotId, setPlanPlotId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [detailFarmer, setDetailFarmer] = useState<Farmer | null>(null);
  const [detailPlots, setDetailPlots] = useState<Plot[]>([]);
  const detail = detailFarmer;
  const assignGroupId = draftGroup && draftGroup !== "none" ? draftGroup : (groups[0]?.id ?? "");
  const listingSort = useTableSort(`${name}:${groupId}`);
  const page = useServerPage(
    `${name}:${groupId}:${revision}`,
    (pageNo, pageSize) =>
      api.listFarmersPage({
        q: name,
        groupId: groupId || undefined,
        page: pageNo,
        pageSize,
      }),
    name === "" && groupId === "" ? farmerPage : null,
  );

  useEffect(() => {
    if (!detailId) {
      setDetailFarmer(null);
      setDetailPlots([]);
      return;
    }
    let alive = true;
    void Promise.all([
      api.getFarmer(detailId),
      collectPages((page, pageSize) => api.listPlotsPage({ farmerId: detailId, page, pageSize })),
    ]).then(([farmer, plots]) => {
      if (!alive) return;
      setDetailFarmer(farmer);
      setDetailPlots(plots);
    });
    return () => {
      alive = false;
    };
  }, [detailId, revision]);

  function openMember(id: string) {
    setDetailId(id);
    setPlanPlotId(null);
    setTab("detail");
    router.replace(`/farmers/manage?farmer=${id}`);
  }

  function closeDetail() {
    setDetailId(null);
    setPlanPlotId(null);
    setTab("listing");
    router.replace("/farmers/manage");
  }

  function openPlan(plotId: string | null) {
    setPlanPlotId(plotId);
    setTab("plan");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการเกษตรกร" />
      <div className="flex items-end gap-1">
        <StatusTab label="จัดการเกษตรกร" active={tab === "listing"} onClick={closeDetail} />
        {detail && (
          <>
            <StatusTab label="รายละเอียดเกษตรกร" active={tab === "detail"} onClick={() => setTab("detail")} />
            {SHOW_MEMBER_PLOT_TABS && (
              <StatusTab label="แปลงของเกษตรกร" active={tab === "plots"} onClick={() => setTab("plots")} />
            )}
            {SHOW_MEMBER_PLAN_TABS && (
              <StatusTab label="แผนการปลูก" active={tab === "plan"} onClick={() => openPlan(null)} />
            )}
          </>
        )}
      </div>
      {tab === "listing" && (
        <div className="mb-6 overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาเกษตรกร</div>
          <form
            className="grid gap-4 px-6 py-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setName(draftName);
              setGroupId(draftGroup);
            }}
          >
            <label className="block text-[14px] font-bold leading-[1.4]">
              ชื่อหรือเบอร์โทร
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              กลุ่ม
              <SearchSelect
                label="กลุ่ม"
                className="mt-1"
                value={draftGroup}
                onChange={setDraftGroup}
                options={[
                  { value: "", label: "ทั้งหมด" },
                  { value: "none", label: "ไม่มีกลุ่ม" },
                  ...[...groups]
                    .sort((a, b) => a.name.localeCompare(b.name, "th"))
                    .map((group) => ({ value: group.id, label: group.name })),
                ]}
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <PrimaryButton type="submit">
                <Glyph icon={Search} />
                ค้นหา
              </PrimaryButton>
              <PrimaryButton
                type="button"
                onClick={() => {
                  setDraftName("");
                  setDraftGroup("");
                  setName("");
                  setGroupId("");
                }}
              >
                <Glyph icon={RotateCcw} />
                ล้าง
              </PrimaryButton>
              <CanEdit resource="farmers">
                <SecondaryButton onClick={() => setMoving(true)}>
                  <Glyph icon={UserPlus} />
                  จัดเข้ากลุ่ม
                </SecondaryButton>
              </CanEdit>
              <CanAdd resource="farmers">
                <SecondaryButton type="button" onClick={() => setAdding(true)}>
                  <Glyph icon={Plus} />
                  เพิ่มเกษตรกร
                </SecondaryButton>
              </CanAdd>
            </div>
          </form>
        </div>
      )}
      <div className={`overflow-hidden border border-frame ${tab === "listing" ? "rounded-[8px]" : "rounded-b-[8px] rounded-tr-[8px]"}`}>
        {tab === "listing" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
              รายการเกษตรกร
              <span className="text-[14px] font-normal">{page.total} คน</span>
            </div>
            <TableScroll>
            <table className={tableClass}>
              <thead className="bg-table">
                <tr>
                  <SortableTh label="เกษตรกร" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="เบอร์โทร" column="tel" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="ตำแหน่ง" column="role" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="รับเข้าโรงสี" column="delivered" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {page.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-ink/60">
                      ไม่พบเกษตรกร
                    </td>
                  </tr>
                )}
                {page.rows.map((farmer, index) => {
                  const leads = groups.some((group) => group.leaderId === farmer.id);
                  return (
                    <tr key={farmer.id} onClick={(event) => openRow(event, () => openMember(farmer.id))} className={rowTone(index)}>
                      <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                      <td className="px-5 py-3">{farmer.tel}</td>
                      <td className="px-5 py-3">{farmer.groupName || groups.find((group) => group.id === farmer.groupId)?.name || "ไม่มีกลุ่ม"}</td>
                      <td className="px-5 py-3">{roleTitle(personRole(roleGrants, groups, farmer.id))}</td>
                      <td className="px-5 py-3">{formatKg(farmer.deliveredKg)}</td>
                      <td className="px-5 py-3 text-right">
                        {!leads && (
                          <CanEdit resource="farmers">
                            <SecondaryButton
                              className="h-9"
                              onClick={() =>
                                setNotice({
                                  tone: "confirm",
                                  message: `ยืนยันให้ ${farmerName(farmer)} ออกจากกลุ่ม`,
                                  accept: async () => setNotice(await reported(assignFarmer(farmer.id, null), "ออกจากกลุ่มแล้ว")),
                                })
                              }
                            >
                              <Glyph icon={UserMinus} />
                              ออกจากกลุ่ม
                            </SecondaryButton>
                          </CanEdit>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </TableScroll>
            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              onPageChange={page.setPage}
              onPageSizeChange={page.setPageSize}
            />
          </>
        )}
        {tab === "detail" && detail && <MemberDetail farmer={detail} onClose={closeDetail} />}
        {SHOW_MEMBER_PLOT_TABS && tab === "plots" && detail && (
          <MemberPlots
            farmer={detail}
            plots={detailPlots}
            onAddRound={SHOW_MEMBER_PLAN_TABS ? (plotId) => openPlan(plotId) : undefined}
            onOpenPlan={SHOW_MEMBER_PLAN_TABS ? (plotId) => openPlan(plotId) : undefined}
            onClose={closeDetail}
          />
        )}
        {SHOW_MEMBER_PLAN_TABS && tab === "plan" && detail && (
          <MemberPlan key={`${detail.id}:${planPlotId ?? "list"}`} farmer={detail} initialPlotId={planPlotId} onClose={closeDetail} />
        )}
      </div>
      {moving && assignGroupId && <MoveFarmer groupId={assignGroupId} onClose={() => setMoving(false)} onAssign={assignFarmer} />}
      {adding && <AddFarmer onClose={() => setAdding(false)} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}

function GroupDirectory() {
  const router = useRouter();
  const { groups, createGroup } = useMill();
  const [creatingGroup, setCreatingGroup] = useState(false);
  const listingSort = useTableSort("groups");
  const ordered = orderBy(groups, listingSort.sort, (group, key) => {
    if (key === "name") return group.name;
    if (key === "leader") return group.leaderName ?? "";
    if (key === "members") return group.memberCount ?? 0;
    if (key === "received") return group.receivedKg ?? 0;
    return group.expectedKg ?? 0;
  });
  const page = usePagination(ordered);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        กลุ่มรับซื้อ
        <span className="text-[14px] font-normal">{groups.length} กลุ่ม</span>
      </div>
      <TableScroll>
<table className={tableClass}>
        <thead className="bg-table">
          <tr>
            <SortableTh label="กลุ่ม" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="หัวหน้า" column="leader" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="สมาชิก" column="members" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="คาดว่าจะได้" column="expected" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="รับเข้าโรงสี" column="received" sort={listingSort.sort} onSort={listingSort.toggleSort} />
          </tr>
        </thead>
        <tbody>
          {page.rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-ink/60">
                ไม่พบกลุ่ม
              </td>
            </tr>
          )}
          {page.rows.map((group, index) => (
              <tr
                key={group.id}
                onClick={(event) => openRow(event, () => router.push(`/groups/manage?group=${group.id}`))}
                className={rowTone(index)}
              >
                <td className="px-5 py-3 font-bold">{group.name}</td>
                <td className="px-5 py-3">{group.leaderName || "—"}</td>
                <td className="px-5 py-3">{group.memberCount ?? 0}</td>
                <td className="px-5 py-3">{formatKg(group.expectedKg ?? 0)}</td>
                <td className="px-5 py-3">{formatKg(group.receivedKg ?? 0)}</td>
              </tr>
            ))}
        </tbody>
      </table>
</TableScroll>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />
      <div className="flex flex-wrap gap-5 px-6 py-4">
        <CanAdd resource="groups">
          <SecondaryButton className="h-9" onClick={() => setCreatingGroup(true)}>
            <Glyph icon={Plus} />
            เพิ่มกลุ่ม
          </SecondaryButton>
        </CanAdd>
      </div>
      {creatingGroup && <CreateGroup onClose={() => setCreatingGroup(false)} onCreate={createGroup} />}
    </>
  );
}

function GroupDetail({ group, onClose }: { group: SupplierGroup; onClose: () => void }) {
  const router = useRouter();
  const { updateGroup, assignFarmer, revision } = useMill();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const [draftLeader, setDraftLeader] = useState(group.leaderId);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [moving, setMoving] = useState(false);
  const [members, setMembers] = useState<Farmer[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  useEffect(() => {
    let alive = true;
    void collectPages((page, pageSize) => api.listFarmersPage({ groupId: group.id, page, pageSize })).then((items) => {
      if (alive) setMembers(items);
    });
    void collectPages((page, pageSize) => api.listPlotsPage({ groupId: group.id, page, pageSize })).then((items) => {
      if (alive) setPlots(items);
    });
    void api.listPlantings({ groupId: group.id }).then((items) => {
      if (alive) setPlantings(items);
    });
    return () => {
      alive = false;
    };
  }, [group.id, revision]);
  const listingSort = useTableSort(group.id);
  const ordered = orderBy(members, listingSort.sort, (farmer, key) => {
    if (key === "name") return farmerName(farmer);
    if (key === "tel") return farmer.tel;
    return farmerVarieties(plots, plantings, farmer.id);
  });
  const page = usePagination(ordered, group.id);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const dirty = draftName !== group.name || draftLeader !== group.leaderId;

  useEffect(() => {
    setEditing(false);
    setDraftName(group.name);
    setDraftLeader(group.leaderId);
  }, [group.id, group.name, group.leaderId]);

  function undo() {
    setDraftName(group.name);
    setDraftLeader(group.leaderId);
    if (!dirty) setEditing(false);
  }

  return (
    <>
      <div className="flex items-center justify-between bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดกลุ่ม
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <form
        className="grid gap-4 border-b border-frame px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
          const leader = members.find((farmer) => farmer.id === draftLeader);
          const changingLeader = draftLeader !== group.leaderId;
          setNotice({
            tone: "confirm",
            message: changingLeader ? `ยืนยันเปลี่ยนหัวหน้าเป็น ${leader ? farmerName(leader) : ""}` : "ยืนยันบันทึกข้อมูลกลุ่ม",
            accept: async () =>
              setNotice(
                await reported(updateGroup(group.id, draftName, draftLeader), changingLeader ? "เปลี่ยนหัวหน้าแล้ว" : "บันทึกกลุ่มแล้ว", () => setEditing(false)),
              ),
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อกลุ่ม
          <input value={draftName} disabled={!editing} onChange={(event) => setDraftName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          หัวหน้ากลุ่ม
          <SearchSelect
            label="หัวหน้ากลุ่ม"
            className="mt-1"
            value={draftLeader}
            disabled={!editing}
            onChange={setDraftLeader}
            options={[...members]
              .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"))
              .map((farmer) => ({ value: farmer.id, label: farmerHandle(farmer) }))}
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <CanEdit resource="groups">
            {editing ? (
              <>
                <DirtyUndoButton onClick={undo} dirty={dirty} />
                <PrimaryButton type="submit">
                  <Glyph icon={Save} />
                  บันทึก
                </PrimaryButton>
              </>
            ) : (
              <SecondaryButton type="button" onClick={() => setEditing(true)}>
                <Glyph icon={Pencil} />
                แก้ไข
              </SecondaryButton>
            )}
          </CanEdit>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-frame bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">สมาชิก · {members.length} คน</div>
      </div>
      <TableScroll>
<table className={tableClass}>
        <thead className="bg-table">
          <tr>
            <SortableTh label="เกษตรกร" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="เบอร์โทร" column="tel" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
          </tr>
        </thead>
        <tbody>
          {page.rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-6 text-ink/60">
                ยังไม่มีสมาชิก
              </td>
            </tr>
          )}
          {page.rows.map((farmer, index) => {
            const leadsGroup = group.leaderId === farmer.id;
            return (
              <tr
                key={farmer.id}
                onClick={(event) => openRow(event, () => router.push(`/farmers/manage?farmer=${farmer.id}`))}
                className={rowTone(index)}
              >
                <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                <td className="px-5 py-3">{farmer.tel}</td>
                <td className="px-5 py-3">{farmerVarieties(plots, plantings, farmer.id)}</td>
                <td className="px-5 py-3 text-right">
                  {leadsGroup ? (
                    <span className="text-[12px] font-bold text-ink/50">หัวหน้ากลุ่ม</span>
                  ) : (
                    <CanEdit resource="farmers">
                      <SecondaryButton
                        className="h-9"
                        onClick={() =>
                          setNotice({
                            tone: "confirm",
                            message: `ยืนยันให้ ${farmerName(farmer)} ออกจากกลุ่ม`,
                            accept: async () => setNotice(await reported(assignFarmer(farmer.id, null), "ออกจากกลุ่มแล้ว")),
                          })
                        }
                      >
                        <Glyph icon={UserMinus} />
                        ออกจากกลุ่ม
                      </SecondaryButton>
                    </CanEdit>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
</TableScroll>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />
      <div className="flex flex-wrap gap-5 px-6 py-4">
        <CanEdit resource="farmers">
          <SecondaryButton className="h-9" onClick={() => setMoving(true)}>
            <Glyph icon={UserPlus} />
            จัดเข้ากลุ่ม
          </SecondaryButton>
        </CanEdit>
      </div>
      {moving && <MoveFarmer groupId={group.id} onClose={() => setMoving(false)} onAssign={assignFarmer} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

function MemberDetail({ farmer, onClose }: { farmer: Farmer; onClose: () => void }) {
  const { groups, updateFarmer } = useMill();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(farmer.firstName);
  const [lastName, setLastName] = useState(farmer.lastName);
  const [tel, setTel] = useState(farmer.tel);
  const [address, setAddress] = useState(farmer.address);
  const [subdistrictId, setSubdistrictId] = useState(farmer.subdistrictId);
  const [districtId, setDistrictId] = useState(farmer.districtId);
  const [provinceId, setProvinceId] = useState(farmer.provinceId);
  const [groupId, setGroupId] = useState(farmer.groupId ?? "");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const leads = groups.find((item) => item.leaderId === farmer.id) ?? null;
  const selectedGroup = groups.find((item) => item.id === (groupId || null)) ?? null;
  const leaderName = selectedGroup?.leaderName || "—";

  useEffect(() => {
    setEditing(false);
    setFirstName(farmer.firstName);
    setLastName(farmer.lastName);
    setTel(farmer.tel);
    setAddress(farmer.address);
    setSubdistrictId(farmer.subdistrictId);
    setDistrictId(farmer.districtId);
    setProvinceId(farmer.provinceId);
    setGroupId(farmer.groupId ?? "");
  }, [farmer.id, farmer.firstName, farmer.lastName, farmer.tel, farmer.address, farmer.subdistrictId, farmer.districtId, farmer.provinceId, farmer.groupId]);

  const dirty =
    firstName !== farmer.firstName ||
    lastName !== farmer.lastName ||
    tel !== farmer.tel ||
    address !== farmer.address ||
    subdistrictId !== farmer.subdistrictId ||
    districtId !== farmer.districtId ||
    provinceId !== farmer.provinceId ||
    (groupId || null) !== farmer.groupId;

  function undo() {
    setFirstName(farmer.firstName);
    setLastName(farmer.lastName);
    setTel(farmer.tel);
    setAddress(farmer.address);
    setSubdistrictId(farmer.subdistrictId);
    setDistrictId(farmer.districtId);
    setProvinceId(farmer.provinceId);
    setGroupId(farmer.groupId ?? "");
    if (!dirty) setEditing(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดเกษตรกร
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <form
        className="grid gap-4 border-b border-frame px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
            const nextGroup = groupId || null;
            const moving = nextGroup !== farmer.groupId;
            const target = groups.find((item) => item.id === nextGroup);
            const message = moving
              ? nextGroup
                ? `ยืนยันย้าย ${farmerName(farmer)} ไป ${target?.name ?? "กลุ่มใหม่"}`
                : `ยืนยันให้ ${farmerName(farmer)} ออกจากกลุ่ม`
              : "ยืนยันบันทึกข้อมูลเกษตรกร";
            setNotice({
              tone: "confirm",
              message,
              accept: async () =>
                setNotice(
                  await reported(
                    updateFarmer(farmer.id, { firstName, lastName, tel, address, provinceId, districtId, subdistrictId, groupId: nextGroup }),
                    moving ? "ย้ายกลุ่มแล้ว" : "บันทึกเกษตรกรแล้ว",
                    () => setEditing(false),
                  ),
                ),
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อ
            <input value={firstName} disabled={!editing} onChange={(event) => setFirstName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            นามสกุล
            <input value={lastName} disabled={!editing} onChange={(event) => setLastName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            เบอร์โทร
            <input value={tel} inputMode="tel" autoComplete="tel" placeholder="0812345678" disabled={!editing} onChange={(event) => setTel(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ที่อยู่
            <RequiredMark />
            <input value={address} disabled={!editing} onChange={(event) => setAddress(event.target.value)} className={fieldClass} />
          </label>
          <PlaceSelects
            provinceId={provinceId}
            districtId={districtId}
            subdistrictId={subdistrictId}
            disabled={!editing}
            onChange={(place) => {
              setProvinceId(place.provinceId);
              setDistrictId(place.districtId);
              setSubdistrictId(place.subdistrictId);
            }}
          />
          <label className="block text-[14px] font-bold leading-[1.4]">
            กลุ่ม
            <SearchSelect
              label="กลุ่ม"
              className="mt-1"
              value={groupId}
              disabled={!editing || leads != null}
              onChange={setGroupId}
              options={[
                { value: "", label: "ไม่มีกลุ่ม" },
                ...[...groups]
                  .sort((a, b) => a.name.localeCompare(b.name, "th"))
                  .map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            หัวหน้ากลุ่ม
            <input value={leaderName} disabled className={fieldClass} />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <CanEdit resource="farmers">
              {editing ? (
                <>
                  <DirtyUndoButton onClick={undo} dirty={dirty} />
                  <PrimaryButton type="submit">
                    <Glyph icon={Save} />
                    บันทึก
                  </PrimaryButton>
                </>
              ) : (
                <SecondaryButton type="button" onClick={() => setEditing(true)}>
                  <Glyph icon={Pencil} />
                  แก้ไข
                </SecondaryButton>
              )}
            </CanEdit>
          </div>
        </form>
      {SHOW_MEMBER_RECEIPT_SECTIONS && (
        <>
          <MemberStanding farmer={farmer} leads={leads} />
          <MillReceiptRounds farmer={farmer} />
        </>
      )}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
function MemberStanding({ farmer, leads }: { farmer: Farmer; leads: SupplierGroup | null }) {
  const { groups, revision } = useMill();
  const [receipts, setReceipts] = useState<MillReceipt[]>([]);
  useEffect(() => {
    let alive = true;
    void api.listReceipts(farmer.id).then((items) => {
      if (alive) setReceipts(items);
    });
    return () => {
      alive = false;
    };
  }, [farmer.id, revision]);
  const group = groups.find((item) => item.id === farmer.groupId) ?? null;
  const mine = receipts.filter((item) => item.farmerId === farmer.id);
  const boughtIn = mine.filter((item) => item.direction === "in").reduce((sum, item) => sum + item.kg, 0);
  const soldOut = mine.filter((item) => item.direction === "out").reduce((sum, item) => sum + item.kg, 0);
  const lent = mine.filter((item) => item.direction === "lend").reduce((sum, item) => sum + item.kg, 0);
  const returned = mine.filter((item) => item.direction === "return").reduce((sum, item) => sum + item.kg, 0);
  const onHand = boughtIn - soldOut;
  const loanOpen = lent - returned;

  return (
    <div className="border-b border-frame">
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">สถานะรับซื้อ</div>
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Fact label="รับซื้อเข้า" value={formatKg(boughtIn)} />
        <Fact label="ขายออก" value={formatKg(soldOut)} />
        <Fact label="คงเหลือ" value={formatKg(onHand)} />
        <Fact label="ให้ยืม" value={formatKg(lent)} />
        <Fact label="ค้างยืม" value={formatKg(loanOpen)} />
      </div>
      {!leads && group && (
        <div className="border-t border-frame px-6 py-4 text-[14px]">
          <span className="font-bold">สมาชิก {group.name}</span>
        </div>
      )}
    </div>
  );
}

function MemberPlots({
  farmer,
  plots,
  onAddRound,
  onOpenPlan,
  onClose,
}: {
  farmer: Farmer;
  plots: Plot[];
  onAddRound?: (plotId: string) => void;
  onOpenPlan?: (plotId: string) => void;
  onClose: () => void;
}) {
  const { varieties, addPlot, removePlot, revision } = useMill();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const editingPlot = plots.find((item) => item.id === editingId) ?? null;
  const showPlan = onOpenPlan != null || onAddRound != null;
  useEffect(() => {
    if (!showPlan) return;
    let alive = true;
    void api.listPlantings({ farmerId: farmer.id }).then((rounds) => {
      if (alive) setPlantings(rounds);
    });
    return () => {
      alive = false;
    };
  }, [farmer.id, revision, showPlan]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">แปลงของเกษตรกร · {farmerName(farmer)}</div>
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <PlotTable
        plots={plots}
        plantings={plantings}
        farmerId={farmer.id}
        onAddRound={onAddRound}
        onOpenPlan={onOpenPlan}
        onEdit={(plot) => setEditingId(plot.id)}
        onRemove={(plot) =>
          setNotice({
            tone: "confirm",
            message: `ยืนยันลบแปลง ${plot.name}`,
            accept: async () => setNotice(await reported(removePlot(plot.id), "ลบแปลงแล้ว", () => setEditingId(null))),
          })
        }
      />
      <div className="flex flex-wrap gap-5 px-6 py-4">
        <CanAdd resource="plots">
          <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
            <Glyph icon={Plus} />
            เพิ่มแปลง
          </SecondaryButton>
        </CanAdd>
      </div>
      {adding && (
        <PlotDialog
          title="เพิ่มแปลง"
          name=""
          area=""
          farmerId={farmer.id}
          schedule={false}
          onClose={() => setAdding(false)}
          onSave={(name, areaRai, _variety, place) =>
            addPlot(farmer.id, {
              name,
              areaRai,
              varietyId: defaultVarietyId(varieties),
              plantedOn: "",
              harvestOn: "",
              estKg: 0,
              provinceId: place.provinceId,
              districtId: place.districtId,
              subdistrictId: place.subdistrictId,
              polygon: place.polygon,
              preview: place.preview,
            })
          }
        />
      )}
      {editingPlot && (
        <Dialog title={`แก้ไขแปลง · ${editingPlot.name}`} wide soft onClose={() => setEditingId(null)}>
          <PlotDetail embedded initialEditing plot={editingPlot} onClose={() => setEditingId(null)} />
        </Dialog>
      )}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

function plotHarvest(planting: Planting | null) {
  if (!planting) return { label: "ยังไม่ปลูก", className: "text-ink/60" };
  const left = daysUntil(planting.harvestOn);
  if (left < 0) return { label: `เลย ${-left} วัน`, className: "text-brand" };
  if (left === 0) return { label: "ถึงกำหนด", className: "text-brand" };
  return { label: `อีก ${left} วัน`, className: "" };
}

function PlotTable({
  plots,
  plantings,
  farmerId,
  onAddRound,
  onOpenPlan,
  onEdit,
  onRemove,
}: {
  plots: Plot[];
  plantings: Planting[];
  farmerId: string;
  onAddRound?: (plotId: string) => void;
  onOpenPlan?: (plotId: string) => void;
  onEdit: (plot: Plot) => void;
  onRemove: (plot: Plot) => void;
}) {
  const [mapPlot, setMapPlot] = useState<Plot | null>(null);
  const showPlan = onOpenPlan != null || onAddRound != null;
  const listingSort = useTableSort(farmerId);
  const ordered = orderBy(plots, listingSort.sort, (plot, key) => {
    const round = currentPlanting(plantings, plot.id);
    if (key === "name") return plot.name;
    if (key === "area") return plot.areaRai;
    if (key === "place") return placeLabel(plot);
    if (key === "variety") return round ? varietyName(round.varietyId) : "";
    if (key === "planted") return round?.plantedOn ?? "";
    if (key === "harvest") return round?.harvestOn ?? "";
    if (key === "kg") return round?.estKg ?? -1;
    return plotHarvest(round).label;
  });
  const page = usePagination(ordered, farmerId);
  const shaped = mapPlot != null && mapPlot.polygon.length >= 4;
  const emptyCols = showPlan ? 8 : 4;
  return (
    <>
    <TableScroll>
<table className={tableClass}>
        <thead className="bg-table">
          <tr>
            <SortableTh label="แปลง" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="พื้นที่" column="area" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            {showPlan && (
              <>
                <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="วันปลูก" column="planted" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="กำหนดเก็บ" column="harvest" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="ที่คาด" column="kg" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="สถานะ" column="status" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              </>
            )}
            {!showPlan && (
              <SortableTh label="ที่ตั้ง" column="place" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            )}
            <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
          </tr>
        </thead>
        <tbody>
          {plots.length === 0 && (
            <tr>
              <td colSpan={emptyCols} className="px-5 py-6 text-ink/60">
                ยังไม่มีแปลง
              </td>
            </tr>
          )}
          {page.rows.map((plot, index) => {
            const round = currentPlanting(plantings, plot.id);
            const harvest = plotHarvest(round);
            return (
              <tr
                key={plot.id}
                onClick={onOpenPlan ? (event) => openRow(event, () => onOpenPlan(plot.id)) : undefined}
                className={rowTone(index)}
              >
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                {showPlan ? (
                  <>
                    <td className="px-5 py-3">{round ? varietyName(round.varietyId) : "—"}</td>
                    <td className="px-5 py-3">{round ? formatThaiDate(round.plantedOn) : "—"}</td>
                    <td className="px-5 py-3">{round ? formatThaiDate(round.harvestOn) : "—"}</td>
                    <td className="px-5 py-3">{round ? formatKg(round.estKg) : "—"}</td>
                    <td className={`px-5 py-3 font-bold ${harvest.className}`}>{harvest.label}</td>
                  </>
                ) : (
                  <td className="px-5 py-3">{placeLabel(plot) || "—"}</td>
                )}
                <td className="whitespace-normal px-5 py-3 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {showPlan &&
                      (round ? (
                        onOpenPlan && (
                          <SecondaryButton className="h-9" onClick={() => onOpenPlan(plot.id)}>
                            แผนการปลูก
                          </SecondaryButton>
                        )
                      ) : (
                        onAddRound && (
                          <CanAdd resource="plantings">
                            <SecondaryButton className="h-9" onClick={() => onAddRound(plot.id)}>
                              <Glyph icon={Plus} />
                              เพิ่มรอบ
                            </SecondaryButton>
                          </CanAdd>
                        )
                      ))}
                    <CanEdit resource="plots">
                      <SecondaryButton className="h-9" onClick={() => onEdit(plot)}>
                        <Glyph icon={Pencil} />
                        แก้ไข
                      </SecondaryButton>
                    </CanEdit>
                    <CanDelete resource="plots">
                      <SecondaryButton className="h-9" onClick={() => onRemove(plot)}>
                        <Glyph icon={Trash2} />
                        ลบแปลง
                      </SecondaryButton>
                    </CanDelete>
                    <button
                      type="button"
                      onClick={() => {
                        if (plot.polygon.length >= 4) {
                          setMapPlot(plot);
                          return;
                        }
                        if (!plot.hasBoundary) {
                          setMapPlot(plot);
                          return;
                        }
                        void api.getPlot(plot.id).then(setMapPlot);
                      }}
                      className="cursor-pointer text-[13px] font-bold text-link underline"
                    >
                      รูปแปลง
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
    <Pagination
      page={page.page}
      pageCount={page.pageCount}
      pageSize={page.pageSize}
      total={page.total}
      onPageChange={page.setPage}
      onPageSizeChange={page.setPageSize}
    />
    {mapPlot && (
      <Dialog title={`แผนที่ · ${mapPlot.name}`} wide onClose={() => setMapPlot(null)}>
        {shaped ? (
          <div className="h-[calc(100vh-12rem)]">
            <FieldMap
              plots={[{ id: mapPlot.id, name: mapPlot.name, color: "#5098BA", muted: false, polygon: mapPlot.polygon }]}
              selectedId={mapPlot.id}
              onSelect={() => {}}
              bottomInset={64}
            />
          </div>
        ) : (
          <p className="text-[14px] text-ink/60">ยังไม่มีรูปแปลง</p>
        )}
      </Dialog>
    )}
    </>
  );
}

function MillReceiptRounds({ farmer }: { farmer: Farmer }) {
  const { varieties, productKinds, createMillReceipt, removeMillReceipt, revision } = useMill();
  const [receipts, setReceipts] = useState<MillReceipt[]>([]);
  useEffect(() => {
    let alive = true;
    void api.listReceipts(farmer.id).then((items) => {
      if (alive) setReceipts(items);
    });
    return () => {
      alive = false;
    };
  }, [farmer.id, revision]);
  const [adding, setAdding] = useState(false);
  const [direction, setDirection] = useState<MillReceiptDirection>("in");
  const [productKindId, setProductKindId] = useState<ProductKind>(() => defaultProductKindId("in", productKinds));
  const [receivedOn, setReceivedOn] = useState("");
  const [varietyId, setVarietyId] = useState<Variety | "">("");
  const [kg, setKg] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const rows = receipts
    .filter((receipt) => receipt.farmerId === farmer.id)
    .slice()
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn) || b.id.localeCompare(a.id));
  const listingSort = useTableSort(rows.map((row) => row.id).join(","));
  const ordered = orderBy(rows, listingSort.sort, (row, key) => {
    if (key === "date") return row.receivedOn;
    if (key === "direction") return millReceiptDirectionLabel(row.direction ?? "in");
    if (key === "kind") return productKindName(row.productKindId);
    if (key === "variety") return varietyName(row.varietyId);
    return row.kg;
  });
  const page = usePagination(ordered, rows.map((row) => row.id).join(","));

  function resetForm() {
    setAdding(false);
    setDirection("in");
    setProductKindId(defaultProductKindId("in", productKinds));
    setReceivedOn("");
    setVarietyId("");
    setKg("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        บัญชีซื้อขายโรงสี
        <CanAdd resource="farmers">
          <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
            <Glyph icon={Plus} />
            เพิ่มรายการ
          </SecondaryButton>
        </CanAdd>
      </div>
      <TableScroll>
        <table className={tableClass}>
          <thead className="bg-table">
            <tr>
              <SortableTh label="วันที่" column="date" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="ประเภท" column="direction" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="ชนิด" column="kind" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="จำนวน" column="kg" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-ink/60">
                  ยังไม่มีรายการซื้อขาย
                </td>
              </tr>
            )}
            {page.rows.map((row, index) => {
              const kind = millReceiptDirectionLabel(row.direction ?? "in");
              const product = productKindName(row.productKindId);
              const tone =
                row.direction === "out" || row.direction === "lend"
                  ? "text-danger"
                  : row.direction === "return"
                    ? "text-brand"
                    : "text-ok";
              return (
                <tr key={row.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                  <td className="px-5 py-3 font-bold">{formatThaiDate(row.receivedOn)}</td>
                  <td className={`px-5 py-3 font-bold ${tone}`}>{kind}</td>
                  <td className="px-5 py-3">{product}</td>
                  <td className="px-5 py-3">{varietyName(row.varietyId)}</td>
                  <td className="px-5 py-3">{formatKg(row.kg)}</td>
                  <td className="px-5 py-3 text-right">
                    <CanDelete resource="farmers">
                      <SecondaryButton
                        className="h-9"
                        onClick={() =>
                          setNotice({
                            tone: "confirm",
                            message: `ยืนยันลบ${kind} ${product} ${varietyName(row.varietyId)} ${formatKg(row.kg)} วันที่ ${formatThaiDate(row.receivedOn)}`,
                            accept: async () => setNotice(await reported(removeMillReceipt(row.id), "ลบรายการแล้ว")),
                          })
                        }
                      >
                        <Glyph icon={Trash2} />
                        ลบ
                      </SecondaryButton>
                    </CanDelete>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScroll>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />
      {adding && (
        <Dialog title="เพิ่มรายการซื้อขาย" onClose={resetForm}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(kg);
              if (!receivedOn || varietyId === "" || !Number.isFinite(amount) || amount <= 0) {
                setNotice({ tone: "error", message: "ใส่วันที่ พันธุ์ และจำนวนกก. ให้ถูกต้อง" });
                return;
              }
              const payload = {
                varietyId: varietyId as Variety,
                productKindId,
                direction,
                kg: Math.round(amount),
                receivedOn,
              };
              setNotice({
                tone: "confirm",
                message: `ยืนยัน${millReceiptDirectionLabel(direction)} ${productKindName(productKindId)} ${varietyName(payload.varietyId)} ${formatKg(payload.kg)}`,
                accept: async () =>
                  setNotice(await reported(createMillReceipt(farmer.id, payload), `บันทึก${millReceiptDirectionLabel(direction)}แล้ว`, resetForm)),
              });
            }}
          >
            <label className="block text-[14px] font-bold leading-[1.4]">
              ประเภท
              <RequiredMark />
              <Select
                label="ประเภท"
                className="mt-1"
                value={direction}
                onChange={(value) => {
                  const next = value as MillReceiptDirection;
                  setDirection(next);
                  setProductKindId(defaultProductKindId(next, productKinds));
                }}
                options={[
                  { value: "in", label: "รับซื้อเข้า" },
                  { value: "out", label: "ขายออก" },
                  { value: "lend", label: "ให้ยืม" },
                  { value: "return", label: "รับคืน" },
                ]}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              ชนิด
              <RequiredMark />
              <Select
                label="ชนิด"
                className="mt-1"
                value={String(productKindId)}
                onChange={(value) => setProductKindId(Number(value))}
                options={productKinds.map((item) => ({ value: String(item.id), label: item.name }))}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              วันที่
              <RequiredMark />
              <DateField label="วันที่" className="mt-1" value={receivedOn} onChange={setReceivedOn} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              พันธุ์
              <RequiredMark />
              <Select
                label="พันธุ์"
                className="mt-1"
                value={varietyId === "" ? "" : String(varietyId)}
                onChange={(value) => setVarietyId(value ? Number(value) : "")}
                placeholder="เลือกพันธุ์"
                options={varieties.map((item) => ({ value: String(item.id), label: item.name }))}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              จำนวน (กก.)
              <RequiredMark />
              <input value={kg} inputMode="numeric" onChange={(event) => setKg(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <div className="flex flex-wrap gap-3">
              <SecondaryButton type="button" onClick={resetForm}>
                <Glyph icon={X} />
                ยกเลิก
              </SecondaryButton>
              <PrimaryButton type="submit">
                <Glyph icon={Save} />
                บันทึก
              </PrimaryButton>
            </div>
          </form>
        </Dialog>
      )}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}

function plantingMark(planting: Planting) {
  if (daysUntil(planting.plantedOn) > 0) return { label: "วางแผน", className: "" };
  return { label: "ปลูกแล้ว", className: "text-ok" };
}

export function MemberPlan({
  farmer,
  initialPlotId = null,
  onClose,
}: {
  farmer: Farmer;
  initialPlotId?: string | null;
  onClose?: () => void;
}) {
  const { revision } = useMill();
  const [owned, setOwned] = useState<Plot[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [activities, setActivities] = useState<PlotActivity[]>([]);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      collectPages((page, pageSize) => api.listPlotsPage({ farmerId: farmer.id, page, pageSize })),
      api.listPlantings({ farmerId: farmer.id }),
    ]).then(async ([plots, rounds]) => {
      if (!alive) return;
      setOwned(plots);
      setPlantings(rounds);
      const lists = await Promise.all(rounds.map((round) => api.listActivities(round.id)));
      if (alive) setActivities(lists.flat());
    });
    return () => {
      alive = false;
    };
  }, [farmer.id, revision]);
  const rounds = owned.flatMap((plot) => {
    const round = openPlanting(plantings, plot.id);
    if (!round) return [];
    const mark = plantingMark(round);
    const area = plantingAreaSummary(plot.areaRai, activities, round.id);
    return [{
      ...plot,
      plantingId: round.id,
      varietyId: round.varietyId,
      plantedOn: round.plantedOn,
      harvestOn: round.harvestOn,
      estKg: round.estKg,
      status: mark.label,
      statusClass: mark.className,
      plantedAreaRai: area.plantedAreaRai,
      unplantedAreaRai: area.unplantedAreaRai,
      stage: currentActivityStage(activities, round.id),
    }];
  });
  const listingSort = useTableSort(farmer.id);
  const ordered = orderBy(rounds, listingSort.sort, (row, key) => {
    if (key === "plot") return row.name;
    if (key === "area") return row.areaRai;
    if (key === "variety") return row.varietyId ? varietyName(row.varietyId) : "";
    if (key === "actual") return row.plantedAreaRai;
    if (key === "left") return row.unplantedAreaRai;
    if (key === "stage") return row.stage;
    if (key === "harvest") return row.harvestOn;
    return row.status;
  });
  const page = usePagination(ordered, farmer.id);
  const [plotId, setPlotId] = useState<string | null>(initialPlotId);
  const [adding, setAdding] = useState(false);
  const listed = ordered.find((plot) => plot.id === plotId) ?? null;
  const draft = listed || !plotId ? null : owned.find((plot) => plot.id === plotId) ?? null;
  const selected = listed ?? (draft ? {
    ...draft,
    plantingId: "",
    varietyId: null as Variety | null,
    plantedOn: "",
    harvestOn: "",
    estKg: 0,
    status: "",
    statusClass: "",
    plantedAreaRai: 0,
    unplantedAreaRai: draft.areaRai,
    stage: "ยังไม่มีกิจกรรม",
  } : null);
  const available = owned.filter((plot) => !openPlanting(plantings, plot.id));

  // Flow step 2: เปิดรอบปลูก → แผน + Timeline ในจอเดียว (ไม่ซ้อนใต้ตาราง)
  if (selected) {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
          <div className="text-[16px] font-bold">แผนรอบ · {selected.name}</div>
          <button
            type="button"
            onClick={() => setPlotId(null)}
            className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-bar"
          >
            ออกจากรายการ
          </button>
        </div>

        <PlanEditor
          key={selected.plantingId || `new:${selected.id}`}
          plot={selected}
          embedded
          onClose={() => setPlotId(null)}
        />

        {selected.plantingId && selected.varietyId != null ? (
          <PlantingActivityPanel
            key={`activities:${selected.plantingId}`}
            plotAreaRai={selected.areaRai}
            plantingId={selected.plantingId}
            varietyId={selected.varietyId}
            plantedOn={selected.plantedOn}
          />
        ) : (
          <div className="border-t border-frame px-6 py-5 text-[14px] text-ink/60">
            บันทึกแผนรอบก่อน แล้วค่อยเพิ่มกิจกรรมบน Timeline
          </div>
        )}
      </>
    );
  }

  // Flow step 1: เลือกรอบปลูกจากรายการ
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">แผนการปลูก · {farmerName(farmer)}</div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
            ปิด
          </button>
        )}
      </div>
      <TableScroll>
        <table className={tableClass}>
          <thead className="bg-table">
            <tr>
              <SortableTh label="แปลง" column="plot" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="พื้นที่" column="area" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="ปลูกจริง" column="actual" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="ยังไม่ปลูก" column="left" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="ขั้นตอนปัจจุบัน" column="stage" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="กำหนดเก็บ" column="harvest" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-ink/60">
                  ยังไม่มีแผน — กดเพิ่มแผน แล้วเลือกแปลง
                </td>
              </tr>
            )}
            {page.rows.map((plot, index) => (
              <tr key={plot.id} onClick={(event) => openRow(event, () => setPlotId(plot.id))} className={rowTone(index)}>
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{formatRai(plot.areaRai)}</td>
                <td className="px-5 py-3">{plot.varietyId ? varietyName(plot.varietyId) : "—"}</td>
                <td className="px-5 py-3">{formatRai(plot.plantedAreaRai)}</td>
                <td className="px-5 py-3">{formatRai(plot.unplantedAreaRai)}</td>
                <td className="px-5 py-3 font-bold">{plot.stage}</td>
                <td className="px-5 py-3">{plot.harvestOn ? formatThaiDate(plot.harvestOn) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />
      <div className="flex flex-wrap gap-5 px-6 py-4">
        <CanAdd resource="plantings">
          <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
            <Glyph icon={Plus} />
            เพิ่มแผน
          </SecondaryButton>
        </CanAdd>
      </div>
      {adding && (
        <ChoosePlanPlot
          plots={available}
          empty={owned.length === 0 ? "ยังไม่มีแปลง" : "ทุกแปลงมีแผนอยู่แล้ว"}
          onClose={() => setAdding(false)}
          onChoose={(id) => {
            setPlotId(id);
            setAdding(false);
          }}
        />
      )}
    </>
  );
}

function ChoosePlanPlot({
  plots,
  empty,
  onClose,
  onChoose,
}: {
  plots: Plot[];
  empty: string;
  onClose: () => void;
  onChoose: (plotId: string) => void;
}) {
  const [plotId, setPlotId] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title="เลือกแปลง" onClose={onClose}>
      {plots.length === 0 ? (
        <p className="text-[14px] text-ink/60">{empty}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!plotId) {
              setError("เลือกแปลง");
              return;
            }
            onChoose(plotId);
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            แปลง
            <RequiredMark />
            <SearchSelect
              label="แปลง"
              className="mt-1"
              placeholder="เลือกแปลง"
              value={plotId}
              onChange={setPlotId}
              options={plots.map((plot) => ({ value: plot.id, label: `${plot.name} · ${plot.areaRai} ไร่` }))}
            />
          </label>
          {error && <p className="text-[14px] text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>
              <Glyph icon={X} />
              ยกเลิก
            </SecondaryButton>
            <CanAdd resource="plantings">
              <PrimaryButton type="submit">
                <Glyph icon={Plus} />
                ทำแผน
              </PrimaryButton>
            </CanAdd>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function PlotWorkspace({ plot, onBack }: { plot: Plot; onBack: () => void }) {
  const { varieties, savePlot, removePlot, savePlanting, removePlanting, revision } = useMill();
  const [rounds, setRounds] = useState<Planting[]>([]);
  const [ownerLabel, setOwnerLabel] = useState(plot.ownerName || "");
  const [groupLabel, setGroupLabel] = useState(plot.groupName || "");
  useEffect(() => {
    let alive = true;
    void api.listPlantings({ plotId: plot.id }).then((items) => {
      if (alive) setRounds(items);
    });
    if (plot.ownerName) {
      setOwnerLabel(plot.ownerName);
      setGroupLabel(plot.groupName || "");
    } else {
      void api.getFarmer(plot.farmerId).then((farmer) => {
        if (!alive) return;
        setOwnerLabel(farmerName(farmer));
        setGroupLabel(farmer.groupName || "");
      });
    }
    return () => {
      alive = false;
    };
  }, [plot.id, plot.farmerId, plot.ownerName, plot.groupName, revision]);
  const current = openPlanting(rounds, plot.id);
  const mark = current ? plantingMark(current) : null;
  const [name, setName] = useState(plot.name);
  const [area, setArea] = useState(String(plot.areaRai));
  const [subdistrictId, setSubdistrictId] = useState(plot.subdistrictId);
  const [districtId, setDistrictId] = useState(plot.districtId);
  const [provinceId, setProvinceId] = useState(plot.provinceId);
  const [variety, setVariety] = useState<Variety>(current?.varietyId ?? defaultVarietyId(varieties));
  const [plantedOn, setPlantedOn] = useState(current?.plantedOn ?? "");
  const [harvestOn, setHarvestOn] = useState(current?.harvestOn ?? "");
  const [estKg, setEstKg] = useState(current ? String(current.estKg) : "");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const measured = plot.polygon.length >= 4 ? plot.areaRai : null;
  const point = plot.polygon.length >= 4 ? centroid(plot.polygon) : null;
  const ownerLabelText = ownerLabel || "—";
  const groupLabelText = groupLabel || "ไม่มีกลุ่ม";
  const savedKg = current ? String(current.estKg) : "";
  const dirty =
    name !== plot.name ||
    area !== String(plot.areaRai) ||
    subdistrictId !== plot.subdistrictId ||
    districtId !== plot.districtId ||
    provinceId !== plot.provinceId ||
    variety !== (current?.varietyId ?? defaultVarietyId(varieties)) ||
    plantedOn !== (current?.plantedOn ?? "") ||
    harvestOn !== (current?.harvestOn ?? "") ||
    estKg !== savedKg;

  useEffect(() => {
    setEditing(false);
    setName(plot.name);
    setArea(String(plot.areaRai));
    setSubdistrictId(plot.subdistrictId);
    setDistrictId(plot.districtId);
    setProvinceId(plot.provinceId);
    setVariety(current?.varietyId ?? defaultVarietyId(varieties));
    setPlantedOn(current?.plantedOn ?? "");
    setHarvestOn(current?.harvestOn ?? "");
    setEstKg(current ? String(current.estKg) : "");
  }, [plot.id, plot.name, plot.areaRai, plot.subdistrictId, plot.districtId, plot.provinceId, current?.id, current?.varietyId, current?.plantedOn, current?.harvestOn, current?.estKg, varieties]);

  function undo() {
    setName(plot.name);
    setArea(String(plot.areaRai));
    setSubdistrictId(plot.subdistrictId);
    setDistrictId(plot.districtId);
    setProvinceId(plot.provinceId);
    setVariety(current?.varietyId ?? defaultVarietyId(varieties));
    setPlantedOn(current?.plantedOn ?? "");
    setHarvestOn(current?.harvestOn ?? "");
    setEstKg(current ? String(current.estKg) : "");
    if (!dirty) setEditing(false);
  }

  return (
    <>
      <div className="border-t border-frame bg-bar px-6 py-4 text-[16px] font-bold text-white">
        {plot.name}
        {mark ? ` · ${mark.label}` : ""}
      </div>
      <form
        className="grid gap-4 border-b border-frame px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
          const areaRai = parseAmount(area);
          const nextKg = parseAmount(estKg);
          if (!name.trim()) {
            setNotice({ tone: "error", message: "กรอกชื่อแปลง" });
            return;
          }
          if (!Number.isFinite(areaRai) || areaRai <= 0) {
            setNotice({ tone: "error", message: "พื้นที่ต้องมากกว่า 0" });
            return;
          }
          if (!plantedOn || !harvestOn) {
            setNotice({ tone: "error", message: "กรอกวันปลูกและกำหนดเก็บ" });
            return;
          }
          if (harvestOn < plantedOn) {
            setNotice({ tone: "error", message: "กำหนดเก็บต้องไม่ก่อนวันปลูก" });
            return;
          }
          if (!Number.isInteger(nextKg) || nextKg <= 0) {
            setNotice({ tone: "error", message: "ที่คาดต้องเป็นจำนวนเต็มมากกว่า 0" });
            return;
          }
          setNotice({
            tone: "confirm",
            message: `ยืนยันบันทึก ${name.trim()}`,
            accept: async () => {
              const plotError = await savePlot(plot.id, { name, areaRai, provinceId, districtId, subdistrictId });
              if (plotError) {
                setNotice({ tone: "error", message: plotError });
                return;
              }
              const saved = await savePlanting(plot.id, {
                plantingId: current?.id ?? null,
                varietyId: variety,
                plantedOn,
                harvestOn,
                estKg: nextKg,
              });
              setNotice(
                saved.error
                  ? { tone: "error", message: saved.error }
                  : { tone: "success", message: "บันทึกแล้ว", done: () => setEditing(false) },
              );
            },
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          เจ้าของแปลง
          <input value={ownerLabelText} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          กลุ่ม
          <input value={groupLabelText} disabled className={fieldClass} />
        </label>
        <PlaceSelects
          provinceId={provinceId}
          districtId={districtId}
          subdistrictId={subdistrictId}
          disabled={!editing}
          onChange={(place) => {
            setProvinceId(place.provinceId);
            setDistrictId(place.districtId);
            setSubdistrictId(place.subdistrictId);
          }}
        />
        <label className="block text-[14px] font-bold leading-[1.4]">
          พิกัด
          <input value={point ? formatCoord(point) : "ยังไม่มีรูป"} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อแปลง
          <input value={name} disabled={!editing} onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พื้นที่วัดได้
          <input value={measured == null ? "ยังไม่มีรูป" : formatRai(measured)} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พื้นที่ (ไร่)
          <input value={area} disabled={!editing} inputMode="decimal" onChange={(event) => setArea(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พันธุ์
          <Select
            label="พันธุ์"
            className="mt-1"
            value={String(variety)}
            disabled={!editing}
            onChange={(next) => setVariety(Number(next))}
            options={varieties.map((item) => ({ value: String(item.id), label: item.name }))}
          />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          วันปลูก
          <DateField
            label="วันปลูก"
            className="mt-1"
            value={plantedOn}
            disabled={!editing}
            max={harvestOn}
            onChange={(next) => {
              setPlantedOn(next);
              if (harvestOn && next && harvestOn < next) setHarvestOn(next);
            }}
          />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          กำหนดเก็บ
          <DateField label="กำหนดเก็บ" className="mt-1" value={harvestOn} disabled={!editing} min={plantedOn} onChange={setHarvestOn} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
          ที่คาด (กก.)
          <input value={estKg} disabled={!editing} inputMode="numeric" onChange={(event) => setEstKg(event.target.value)} className={fieldClass} />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <CanEdit resource="plantings">
            {editing ? (
              <>
                <DirtyUndoButton onClick={undo} dirty={dirty} />
                <PrimaryButton type="submit">
                  <Glyph icon={Save} />
                  บันทึก
                </PrimaryButton>
              </>
            ) : (
              <SecondaryButton type="button" onClick={() => setEditing(true)}>
                <Glyph icon={Pencil} />
                แก้ไข
              </SecondaryButton>
            )}
          </CanEdit>
          {current && (
            <CanDelete resource="plantings">
              <SecondaryButton
                type="button"
                onClick={() =>
                  setNotice({
                    tone: "confirm",
                    message: `ยืนยันลบแผนรอบ ${formatThaiDate(current.plantedOn)}`,
                    accept: async () => setNotice(await reported(removePlanting(current.id), "ลบแผนแล้ว")),
                  })
                }
              >
                <Glyph icon={Trash2} />
                ลบแผน
              </SecondaryButton>
            </CanDelete>
          )}
          <CanDelete resource="plots">
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบแปลง ${plot.name}`,
                  accept: async () => setNotice(await reported(removePlot(plot.id), "ลบแปลงแล้ว", onBack)),
                })
              }
            >
              <Glyph icon={Trash2} />
              ลบแปลง
            </SecondaryButton>
          </CanDelete>
        </div>
      </form>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

function parseAmount(value: string) {
  const amount = Number(value.trim());
  return Number.isFinite(amount) ? amount : Number.NaN;
}

function RequiredMark() {
  return <span className="text-danger"> *</span>;
}

export function AddFarmer({ onClose }: { onClose: () => void }) {
  const { groups, createFarmer } = useMill();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tel, setTel] = useState("");
  const [address, setAddress] = useState("");
  const [provinceId, setProvinceId] = useState(0);
  const [districtId, setDistrictId] = useState(0);
  const [subdistrictId, setSubdistrictId] = useState(0);
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog title="เพิ่มเกษตรกร" onClose={onClose}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            const message = await createFarmer({
              firstName,
              lastName,
              tel,
              address,
              provinceId,
              districtId,
              subdistrictId,
              groupId: groupId || null,
            });
            if (message) {
              setError(message);
              return;
            }
            onClose();
          })();
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อ
          <RequiredMark />
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          นามสกุล
          <RequiredMark />
          <input value={lastName} onChange={(event) => setLastName(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          เบอร์โทร
          <RequiredMark />
          <input value={tel} inputMode="tel" autoComplete="tel" placeholder="0812345678" onChange={(event) => setTel(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          ที่อยู่
          <RequiredMark />
          <input value={address} onChange={(event) => setAddress(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <PlaceSelects
          provinceId={provinceId}
          districtId={districtId}
          subdistrictId={subdistrictId}
          onChange={(place) => {
            setProvinceId(place.provinceId);
            setDistrictId(place.districtId);
            setSubdistrictId(place.subdistrictId);
          }}
        />
        <label className="block text-[14px] font-bold leading-[1.4]">
          กลุ่ม
          <SearchSelect
            label="กลุ่ม"
            className="mt-1"
            placeholder="ไม่เลือก"
            value={groupId}
            onChange={setGroupId}
            options={[
              { value: "", label: "ไม่เลือก" },
              ...[...groups].sort((a, b) => a.name.localeCompare(b.name, "th")).map((group) => ({ value: group.id, label: group.name })),
            ]}
          />
        </label>
        {error && <p className="text-[14px] text-danger sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <SecondaryButton onClick={onClose}>
            <Glyph icon={X} />
            ยกเลิก
          </SecondaryButton>
          <PrimaryButton type="submit">
            <Glyph icon={Save} />
            บันทึก
          </PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}

export function PlaceSelects({
  provinceId,
  districtId,
  subdistrictId,
  disabled = false,
  required = false,
  onChange,
}: {
  provinceId: number;
  districtId: number;
  subdistrictId: number;
  disabled?: boolean;
  required?: boolean;
  onChange: (place: PlaceIds) => void;
}) {
  const provinces = useMemo(() => provinceOptions(), []);
  const districts = useMemo(() => districtOptions(provinceId), [provinceId]);
  const subdistricts = useMemo(() => subdistrictOptions(provinceId, districtId), [provinceId, districtId]);
  return (
    <>
      <label className="block text-[14px] font-bold leading-[1.4]">
        จังหวัด
        {required && <RequiredMark />}
        <SearchSelect
          label="จังหวัด"
          className="mt-1"
          placeholder="เลือกจังหวัด"
          value={provinceId ? String(provinceId) : ""}
          disabled={disabled}
          options={provinces}
          onChange={(next) => onChange({ provinceId: Number(next) || 0, districtId: 0, subdistrictId: 0 })}
        />
      </label>
      <label className="block text-[14px] font-bold leading-[1.4]">
        อำเภอ
        {required && <RequiredMark />}
        <SearchSelect
          label="อำเภอ"
          className="mt-1"
          placeholder={provinceId ? "เลือกอำเภอ" : "เลือกจังหวัดก่อน"}
          value={districtId ? String(districtId) : ""}
          disabled={disabled || !provinceId}
          options={districts}
          onChange={(next) => onChange({ provinceId, districtId: Number(next) || 0, subdistrictId: 0 })}
        />
      </label>
      <label className="block text-[14px] font-bold leading-[1.4]">
        ตำบล
        {required && <RequiredMark />}
        <SearchSelect
          label="ตำบล"
          className="mt-1"
          placeholder={districtId ? "เลือกตำบล" : "เลือกอำเภอก่อน"}
          value={subdistrictId ? String(subdistrictId) : ""}
          disabled={disabled || !districtId}
          options={subdistricts}
          onChange={(next) => onChange({ provinceId, districtId, subdistrictId: Number(next) || 0 })}
        />
      </label>
    </>
  );
}

export function PlotDialog({
  title,
  name,
  area,
  farmerId,
  schedule = true,
  onClose,
  onSave,
}: {
  title: string;
  name: string;
  area: string;
  farmerId: string;
  schedule?: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    areaRai: number,
    variety: Variety,
    place: {
      provinceId: number;
      districtId: number;
      subdistrictId: number;
      polygon: [number, number][];
      preview?: Blob | null;
    },
    schedule: { plantedOn: string; harvestOn: string; estKg: number },
  ) => Promise<string | null>;
}) {
  const { varieties, groups } = useMill();
  const [owner, setOwner] = useState<Farmer | null>(null);
  const [neighborPlots, setNeighborPlots] = useState<Plot[]>([]);
  const group = groups.find((item) => item.id === owner?.groupId) ?? null;
  const [plotName, setPlotName] = useState(name);
  const [areaRai, setAreaRai] = useState(area);
  const [boundary, setBoundary] = useState<[number, number][]>([]);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const savingRef = useRef(false);
  const [subdistrictId, setSubdistrictId] = useState(0);
  const [districtId, setDistrictId] = useState(0);
  const [provinceId, setProvinceId] = useState(0);
  useEffect(() => {
    let alive = true;
    void api.getFarmer(farmerId).then((farmer) => {
      if (!alive) return;
      setOwner(farmer);
      setProvinceId((current) => current || farmer.provinceId);
      setDistrictId((current) => current || farmer.districtId);
      setSubdistrictId((current) => current || farmer.subdistrictId);
    });
    void collectPages((page, pageSize) => api.listPlotsPage({ farmerId, page, pageSize })).then((items) => {
      if (alive) setNeighborPlots(items);
    });
    return () => {
      alive = false;
    };
  }, [farmerId]);
  const [variety, setVariety] = useState<Variety>(() => defaultVarietyId(varieties));
  const [plantedOn, setPlantedOn] = useState("");
  const [harvestOn, setHarvestOn] = useState("");
  const [estKg, setEstKg] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;

  return (
    <>
      <Dialog title={title} onClose={onClose}>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const nextArea = parseAmount(areaRai);
            const nextKg = parseAmount(estKg);
            if (!plotName.trim()) {
              setNotice({ tone: "error", message: "กรอกชื่อแปลง" });
              return;
            }
            if (!isCompletePlace({ provinceId, districtId, subdistrictId })) {
              setNotice({ tone: "error", message: "เลือกตำบล อำเภอ และจังหวัด" });
              return;
            }
            if (!Number.isFinite(nextArea) || nextArea <= 0) {
              setNotice({ tone: "error", message: "พื้นที่ต้องมากกว่า 0" });
              return;
            }
            if (schedule && (!plantedOn || !harvestOn)) {
              setNotice({ tone: "error", message: "กรอกวันปลูกและกำหนดเก็บ" });
              return;
            }
            if (schedule && harvestOn < plantedOn) {
              setNotice({ tone: "error", message: "กำหนดเก็บต้องไม่ก่อนวันปลูก" });
              return;
            }
            if (schedule && (!Number.isInteger(nextKg) || nextKg <= 0)) {
              setNotice({ tone: "error", message: "ที่คาดต้องเป็นจำนวนเต็มมากกว่า 0" });
              return;
            }
            if (savingRef.current) return;
            setNotice({
              tone: "confirm",
              message: `ยืนยัน${title}`,
              accept: async () => {
                if (savingRef.current) return;
                savingRef.current = true;
                // Drop confirm immediately so a second click cannot re-enter create.
                setNotice({ tone: "success", message: "กำลังบันทึก…" });
                try {
                  setNotice(
                    await reported(
                      onSave(
                        plotName,
                        nextArea,
                        variety,
                        { provinceId, districtId, subdistrictId, polygon: boundary, preview },
                        { plantedOn, harvestOn, estKg: nextKg },
                      ),
                      "บันทึกแปลงแล้ว",
                      onClose,
                    ),
                  );
                } finally {
                  savingRef.current = false;
                }
              },
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            เจ้าของแปลง
            <input value={owner ? farmerName(owner) : "—"} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            กลุ่ม
            <input value={group?.name || owner?.groupName || "ไม่มีกลุ่ม"} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อแปลง
            <RequiredMark />
            <input value={plotName} onChange={(event) => setPlotName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พื้นที่ (ไร่)
            <RequiredMark />
            <input value={areaRai} inputMode="decimal" onChange={(event) => setAreaRai(event.target.value)} className={fieldClass} />
            <button
              type="button"
              onClick={() => {
                setDraft([]);
                setDrawing(true);
              }}
              className="mt-2 text-[14px] font-bold text-link underline"
            >
              {boundary.length > 0 ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
            </button>
            <p className="mt-1 text-[12px] font-normal text-ink/60">
              {boundary.length > 0 ? `วาดแล้ว · ${formatRai(Number(areaRai) || 0)} · ที่อยู่ถูกใส่จากตำแหน่งรูป แก้ตัวเลขได้ถ้าไม่ตรง` : "คลิกเพื่อวาดรูปแปลง แล้วพื้นที่กับที่อยู่จะถูกใส่ให้"}
            </p>
          </label>
          <PlaceSelects
            provinceId={provinceId}
            districtId={districtId}
            subdistrictId={subdistrictId}
            required
            onChange={(place) => {
              setProvinceId(place.provinceId);
              setDistrictId(place.districtId);
              setSubdistrictId(place.subdistrictId);
            }}
          />
          {schedule && (
            <label className="block text-[14px] font-bold leading-[1.4]">
              พันธุ์
              <RequiredMark />
              <Select
                label="พันธุ์"
                className="mt-1"
                value={String(variety)}
                onChange={(next) => setVariety(Number(next))}
                options={varieties.map((item) => ({ value: String(item.id), label: item.name }))}
              />
            </label>
          )}
          {schedule && (
            <>
              <label className="block text-[14px] font-bold leading-[1.4]">
                วันปลูก
                <RequiredMark />
                <DateField
                  label="วันปลูก"
                  className="mt-1"
                  value={plantedOn}
                  max={harvestOn}
                  onChange={(next) => {
                    setPlantedOn(next);
                    if (harvestOn && next && harvestOn < next) setHarvestOn(next);
                  }}
                />
              </label>
              <label className="block text-[14px] font-bold leading-[1.4]">
                กำหนดเก็บ
                <RequiredMark />
                <DateField label="กำหนดเก็บ" className="mt-1" value={harvestOn} min={plantedOn} onChange={setHarvestOn} />
              </label>
              <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
                ที่คาด (กก.)
                <RequiredMark />
                <input value={estKg} inputMode="numeric" onChange={(event) => setEstKg(event.target.value)} className={fieldClass} />
              </label>
            </>
          )}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <SecondaryButton onClick={onClose}>
              <Glyph icon={X} />
              ยกเลิก
            </SecondaryButton>
            <PrimaryButton type="submit">
                <Glyph icon={Save} />
                บันทึก
              </PrimaryButton>
          </div>
        </form>
      </Dialog>
      {drawing && (
        <DrawBoundary
          plots={neighborPlots.filter((plot) => plot.hasBoundary || plot.polygon.length >= 4)}
          draft={draft}
          onDraft={setDraft}
          place={{ provinceId, districtId, subdistrictId }}
          onUse={(ring, nextPreview) => {
            void (async () => {
              const measured = await measureRingAreaRai(ring);
              if (measured == null) return;
              const point = centroid(ring);
              const place = placeAt(point.lng, point.lat);
              setBoundary(ring);
              setPreview(nextPreview);
              setAreaRai(String(measured));
              if (place) {
                setProvinceId(place.provinceId);
                setDistrictId(place.districtId);
                setSubdistrictId(place.subdistrictId);
              }
              setDrawing(false);
            })();
          }}
          onClose={() => setDrawing(false)}
        />
      )}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

export function DrawBoundary({
  plots,
  draft,
  onDraft,
  onUse,
  onClose,
  title = "วาดขอบเขต",
  place,
  excludeId,
}: {
  plots: Plot[];
  draft: [number, number][];
  onDraft: (next: [number, number][]) => void;
  onUse: (ring: [number, number][], preview: Blob | null) => void;
  onClose: () => void;
  title?: string;
  place?: { provinceId: number; districtId: number; subdistrictId: number } | null;
  excludeId?: string;
}) {
  const mapRef = useRef<FieldMapHandle>(null);
  const closed = isClosedRing(draft);
  const [measured, setMeasured] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [mapPlots, setMapPlots] = useState(() =>
    plots
      .filter((plot) => plot.polygon.length >= 4)
      .map((plot) => ({ id: plot.id, name: plot.name, color: "#5098BA", muted: true, polygon: plot.polygon })),
  );
  const focus = placeCenter(place);
  const plotKey = plots.map((plot) => plot.id).join(",");

  useEffect(() => {
    let alive = true;
    const allow = new Set(plots.map((plot) => plot.id));
    void api.listPlotBoundaries().then((items) => {
      if (!alive) return;
      const scoped = allow.size === 0 ? items : items.filter((item) => allow.has(item.id));
      setMapPlots(
        scoped
          .filter((item) => item.id !== excludeId)
          .map((item) => ({ id: item.id, name: item.name, color: "#5098BA", muted: true, polygon: item.polygon })),
      );
    });
    return () => {
      alive = false;
    };
  }, [plotKey, plots, excludeId]);

  useEffect(() => {
    if (!closed) {
      setMeasured(null);
      setMeasuring(false);
      return;
    }
    let alive = true;
    setMeasuring(true);
    void measureRingAreaRai(draft).then((value) => {
      if (!alive) return;
      setMeasured(value);
      setMeasuring(false);
    });
    return () => {
      alive = false;
    };
  }, [closed, draft]);

  function placePoint(lng: number, lat: number) {
    if (closed) return;
    const ring = openRing(draft);
    const next: [number, number] = [lng, lat];
    if (ring.length >= 3 && nearPoint(ring[0], next)) {
      const shape = closeRing(ring);
      if (shape) onDraft(shape);
      return;
    }
    onDraft([...ring, next]);
  }
  return (
    <Dialog title={title} wide onClose={onClose}>
      <p className="mb-3 text-[14px]">คลิกบนแผนที่เพื่อวางจุด แล้วคลิกจุดแรกหรือกดปิดรูป ที่อยู่จะถูกใส่จากตำแหน่งรูป</p>
      <div className="h-[calc(100vh-12rem)]">
        <FieldMap
          ref={mapRef}
          plots={mapPlots}
          selectedId={null}
          onSelect={() => {}}
          draft={draft}
          onDraftClick={closed ? undefined : placePoint}
          bottomInset={48}
          focus={focus}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!closed && (
          <>
            <span className="text-[14px]">{openRing(draft).length} จุด</span>
            <SecondaryButton className="h-9" onClick={() => onDraft(openRing(draft).slice(0, -1))} disabled={openRing(draft).length === 0}>
              ลบจุด
            </SecondaryButton>
            <SecondaryButton
              className="h-9"
              disabled={openRing(draft).length < 3}
              onClick={() => {
                const shape = closeRing(openRing(draft));
                if (shape) onDraft(shape);
              }}
            >
              ปิดรูป
            </SecondaryButton>
          </>
        )}
        {closed && (
          <>
            <span className="text-[14px] font-bold">
              {capturing ? "กำลังแคปรูป…" : measuring || measured == null ? "กำลังคำนวณ…" : formatRai(measured)}
            </span>
            <PrimaryButton
              type="button"
              className="h-9"
              disabled={measuring || measured == null || capturing}
              onClick={() => {
                void (async () => {
                  setCapturing(true);
                  try {
                    const preview = (await mapRef.current?.capturePreview(draft)) ?? null;
                    onUse(draft, preview);
                  } finally {
                    setCapturing(false);
                  }
                })();
              }}
            >
              ใช้พื้นที่นี้
            </PrimaryButton>
            <SecondaryButton className="h-9" onClick={() => onDraft([])}>
              วาดใหม่
            </SecondaryButton>
          </>
        )}
        <SecondaryButton className="h-9" onClick={onClose}>
          ยกเลิก
        </SecondaryButton>
      </div>
    </Dialog>
  );
}

function nearPoint(a: [number, number], b: [number, number]) {
  const lng = a[0] - b[0];
  const lat = a[1] - b[1];
  return lng * lng + lat * lat < 0.00008 * 0.00008;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-bold leading-[1.4]">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function CreateGroup({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, leaderId: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  return (
    <>
      <Dialog title="สร้างกลุ่ม" onClose={onClose}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setNotice({ tone: "error", message: "กรอกชื่อกลุ่ม" });
              return;
            }
            if (!leaderId) {
              setNotice({ tone: "error", message: "เลือกหัวหน้ากลุ่ม" });
              return;
            }
            setNotice({
              tone: "confirm",
              message: "ยืนยันสร้างกลุ่ม",
              accept: async () => setNotice(await reported(onCreate(name, leaderId), "สร้างกลุ่มแล้ว", onClose)),
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อกลุ่ม
            <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            หัวหน้ากลุ่ม
            <div className="mt-1">
              <FarmerSelect value={leaderId} onChange={setLeaderId} />
            </div>
          </label>
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>
              <Glyph icon={X} />
              ยกเลิก
            </SecondaryButton>
            <PrimaryButton type="submit">
                <Glyph icon={Save} />
                บันทึก
              </PrimaryButton>
          </div>
        </form>
      </Dialog>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

function MoveFarmer({
  groupId,
  onClose,
  onAssign,
}: {
  groupId: string;
  onClose: () => void;
  onAssign: (farmerId: string, groupId: string) => Promise<string | null>;
}) {
  const { groups } = useMill();
  const [farmerId, setFarmerId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const groupName = groups.find((group) => group.id === groupId)?.name ?? "กลุ่ม";
  return (
    <>
      <Dialog title="จัดเข้ากลุ่ม" onClose={onClose}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!farmerId) {
              setNotice({ tone: "error", message: "เลือกเกษตรกร" });
              return;
            }
            void api.getFarmer(farmerId).then((person) => {
              setNotice({
                tone: "confirm",
                message: `ยืนยันจัด ${farmerName(person)} เข้า${groupName}`,
                accept: async () => setNotice(await reported(onAssign(person.id, groupId), "จัดเข้ากลุ่มแล้ว", onClose)),
              });
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            เกษตรกร
            <div className="mt-1">
              <FarmerSelect value={farmerId} onChange={setFarmerId} />
            </div>
          </label>
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>
              <Glyph icon={X} />
              ยกเลิก
            </SecondaryButton>
            <PrimaryButton type="submit">
                <Glyph icon={Save} />
                บันทึก
              </PrimaryButton>
          </div>
        </form>
      </Dialog>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
