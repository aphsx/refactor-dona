"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMill } from "@/components/store";
import { Dialog, FarmerSelect, PageHeader, Pagination, PrimaryButton, SecondaryButton, SearchSelect, StatusTab, ConfirmAlert, ResultAlert, inputClass, usePagination } from "@/components/ui";
import { VARIETIES, daysUntil, farmerName, farmerVarieties, formatBaht, formatKg, formatThaiDate, openPlanting, plantingsOf, type Farmer, type Planting, type Plot, type SupplierGroup, type Variety } from "@/lib/mill";

type Notice =
  | { tone: "confirm"; message: string; accept: () => void }
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
        if (notice.done) notice.done();
        else onDismiss();
      }}
    />
  );
}

function reported(error: string | null, success: string, done?: () => void): Notice {
  return error ? { tone: "error", message: error } : { tone: "success", message: success, done };
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
  const { groups, farmers, plots, plantings, createGroup } = useMill();
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
    const needle = name.trim().toLowerCase();
    return groups.filter((group) => {
      if (needle && !group.name.toLowerCase().includes(needle)) return false;
      if (leaderId && group.leaderId !== leaderId) return false;
      return true;
    });
  }, [groups, name, leaderId]);
  const page = usePagination(rows, `${name}:${leaderId}`);

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
          <span className="flex h-10 items-center rounded-t-[6px] bg-bar px-4 text-[14px] font-bold text-white">รายละเอียดกลุ่ม</span>
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
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              หัวหน้ากลุ่ม
              <SearchSelect
                label="หัวหน้ากลุ่ม"
                className="mt-1"
                value={draftLeader}
                onChange={setDraftLeader}
                options={[
                  { value: "", label: "ทั้งหมด" },
                  ...[...farmers]
                    .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"))
                    .map((farmer) => ({ value: farmer.id, label: farmerName(farmer) })),
                ]}
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <PrimaryButton type="submit">ค้นหา</PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setDraftName("");
                  setDraftLeader("");
                  setName("");
                  setLeaderId("");
                }}
              >
                ล้าง
              </SecondaryButton>
              <SecondaryButton onClick={() => setCreatingGroup(true)}>สร้างกลุ่ม</SecondaryButton>
            </div>
          </form>
        </div>
      )}
      <div className={`overflow-hidden border border-frame ${tab === "listing" ? "rounded-[8px]" : "rounded-b-[8px] rounded-tr-[8px]"}`}>
        {tab === "listing" && (
          <>
            <table className="w-full border-collapse text-left text-[14px]">
              <thead className="bg-table">
                <tr>
                  {["กลุ่ม", "หัวหน้า", "สมาชิก", "คาดว่าจะได้", "รับเข้าแล้ว"].map((label) => (
                    <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                      {label}
                    </th>
                  ))}
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
                {page.rows.map((group, index) => {
                  const leader = farmers.find((farmer) => farmer.id === group.leaderId);
                  const people = farmers.filter((farmer) => farmer.groupId === group.id);
                  const ids = new Set(people.map((farmer) => farmer.id));
                  const expected = plantings.filter((planting) => !planting.delivered && ids.has(plots.find((plot) => plot.id === planting.plotId)?.farmerId ?? "")).reduce((sum, planting) => sum + planting.estKg, 0);
                  const received = people.reduce((sum, farmer) => sum + farmer.deliveredKg, 0);
                  return (
                    <tr key={group.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                      <td className="px-5 py-3">
                        <button type="button" className="font-bold text-link underline" onClick={() => openGroup(group.id)}>
                          {group.name}
                        </button>
                      </td>
                      <td className="px-5 py-3">{leader ? farmerName(leader) : "—"}</td>
                      <td className="px-5 py-3">{people.length}</td>
                      <td className="px-5 py-3">{formatKg(expected)}</td>
                      <td className="px-5 py-3">{formatKg(received)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
  const { groups, farmers, plots, assignFarmer } = useMill();
  const [tab, setTab] = useState<"listing" | "detail" | "plan">("listing");
  const [draftName, setDraftName] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [planPlotId, setPlanPlotId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const detail = farmers.find((farmer) => farmer.id === detailId) ?? null;
  const assignGroupId = draftGroup && draftGroup !== "none" ? draftGroup : (groups[0]?.id ?? "");

  const rows = useMemo(() => {
    const needle = name.trim().toLowerCase();
    return farmers.filter((farmer) => {
      if (groupId === "none" && farmer.groupId != null) return false;
      if (groupId && groupId !== "none" && farmer.groupId !== groupId) return false;
      if (!needle) return true;
      return `${farmerName(farmer)} ${farmer.tel}`.toLowerCase().includes(needle);
    });
  }, [farmers, name, groupId]);
  const page = usePagination(rows, `${name}:${groupId}`);

  function openMember(id: string) {
    setDetailId(id);
    setPlanPlotId(null);
    setTab("detail");
  }

  function closeDetail() {
    setDetailId(null);
    setPlanPlotId(null);
    setTab("listing");
  }

  function openPlan(plotId: string | null) {
    setPlanPlotId(plotId);
    setTab("plan");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการสมาชิก" />
      <div className="flex items-end gap-1">
        <StatusTab label="จัดการสมาชิก" active={tab === "listing"} onClick={closeDetail} />
        {detail && (
          <>
            <StatusTab label="รายละเอียดสมาชิก" active={tab === "detail"} onClick={() => setTab("detail")} />
            <StatusTab label="แผนการปลูก" active={tab === "plan"} onClick={() => openPlan(null)} />
          </>
        )}
      </div>
      {tab === "listing" && (
        <div className="mb-6 overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาสมาชิก</div>
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
              <PrimaryButton type="submit">ค้นหา</PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setDraftName("");
                  setDraftGroup("");
                  setName("");
                  setGroupId("");
                }}
              >
                ล้าง
              </SecondaryButton>
              <SecondaryButton onClick={() => setMoving(true)}>จัดเข้ากลุ่ม</SecondaryButton>
            </div>
          </form>
        </div>
      )}
      <div className={`overflow-hidden border border-frame ${tab === "listing" ? "rounded-[8px]" : "rounded-b-[8px] rounded-tr-[8px]"}`}>
        {tab === "listing" && (
          <>
            <table className="w-full border-collapse text-left text-[14px]">
              <thead className="bg-table">
                <tr>
                  {["คู่ค้า", "เบอร์โทร", "กลุ่ม", "พันธุ์", "รับเข้าแล้ว", ""].map((label) => (
                    <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-ink/60">
                      ไม่พบสมาชิก
                    </td>
                  </tr>
                )}
                {page.rows.map((farmer, index) => {
                  const leads = groups.some((group) => group.leaderId === farmer.id);
                  return (
                    <tr key={farmer.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                      <td className="px-5 py-3">
                        <button type="button" className="font-bold text-link underline" onClick={() => openMember(farmer.id)}>
                          {farmerName(farmer)}
                        </button>
                      </td>
                      <td className="px-5 py-3">{farmer.tel}</td>
                      <td className="px-5 py-3">{groups.find((group) => group.id === farmer.groupId)?.name ?? "ไม่มีกลุ่ม"}</td>
                      <td className="px-5 py-3">{farmerVarieties(plots, farmer.id)}</td>
                      <td className="px-5 py-3">{formatKg(farmer.deliveredKg)}</td>
                      <td className="px-5 py-3 text-right">
                        {leads ? (
                          <span className="text-[12px] font-bold text-ink/50">หัวหน้า</span>
                        ) : (
                          <button
                            type="button"
                            className="font-bold text-link underline"
                            onClick={() =>
                              setNotice({
                                tone: "confirm",
                                message: `ยืนยันให้ ${farmerName(farmer)} ออกจากกลุ่ม`,
                                accept: () => setNotice(reported(assignFarmer(farmer.id, null), "ออกจากกลุ่มแล้ว")),
                              })
                            }
                          >
                            ออกจากกลุ่ม
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        {tab === "detail" && detail && <MemberDetail farmer={detail} onClose={closeDetail} onAddRound={(plotId) => openPlan(plotId)} />}
        {tab === "plan" && detail && <MemberPlan key={`${detail.id}:${planPlotId ?? "list"}`} farmer={detail} initialPlotId={planPlotId} onClose={closeDetail} />}
      </div>
      {moving && assignGroupId && <MoveFarmer groupId={assignGroupId} onClose={() => setMoving(false)} onAssign={assignFarmer} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}

function GroupDirectory() {
  const { groups, farmers, plots, plantings } = useMill();
  const page = usePagination(groups);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        กลุ่มรับซื้อ
        <span className="text-[14px]">{groups.length} กลุ่ม</span>
      </div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["กลุ่ม", "หัวหน้า", "สมาชิก", "คาดว่าจะได้", "รับเข้าแล้ว"].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
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
          {page.rows.map((group, index) => {
            const leader = farmers.find((farmer) => farmer.id === group.leaderId);
            const people = farmers.filter((farmer) => farmer.groupId === group.id);
            const ids = new Set(people.map((farmer) => farmer.id));
            const expected = plantings.filter((planting) => !planting.delivered && ids.has(plots.find((plot) => plot.id === planting.plotId)?.farmerId ?? "")).reduce((sum, planting) => sum + planting.estKg, 0);
            const received = people.reduce((sum, farmer) => sum + farmer.deliveredKg, 0);
            return (
              <tr key={group.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3">
                  <Link href={`/groups/manage?group=${group.id}`} className="font-bold text-link underline">
                    {group.name}
                  </Link>
                </td>
                <td className="px-5 py-3">{leader ? farmerName(leader) : "—"}</td>
                <td className="px-5 py-3">{people.length}</td>
                <td className="px-5 py-3">{formatKg(expected)}</td>
                <td className="px-5 py-3">{formatKg(received)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />
    </>
  );
}

function GroupDetail({ group, onClose }: { group: SupplierGroup; onClose: () => void }) {
  const { farmers, plots, updateGroup, assignFarmer } = useMill();
  const [draftName, setDraftName] = useState(group.name);
  const [draftLeader, setDraftLeader] = useState(group.leaderId);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [moving, setMoving] = useState(false);
  const members = farmers.filter((farmer) => farmer.groupId === group.id);
  const page = usePagination(members, group.id);

  useEffect(() => {
    setDraftName(group.name);
    setDraftLeader(group.leaderId);
  }, [group.id, group.name, group.leaderId]);

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
          const leader = members.find((farmer) => farmer.id === draftLeader);
          const changingLeader = draftLeader !== group.leaderId;
          setNotice({
            tone: "confirm",
            message: changingLeader ? `ยืนยันเปลี่ยนหัวหน้าเป็น ${leader ? farmerName(leader) : ""}` : "ยืนยันบันทึกข้อมูลกลุ่ม",
            accept: () => setNotice(reported(updateGroup(group.id, draftName, draftLeader), changingLeader ? "เปลี่ยนหัวหน้าแล้ว" : "บันทึกกลุ่มแล้ว")),
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อกลุ่ม
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          หัวหน้ากลุ่ม
          <SearchSelect
            label="หัวหน้ากลุ่ม"
            className="mt-1"
            value={draftLeader}
            onChange={setDraftLeader}
            options={[...members]
              .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"))
              .map((farmer) => ({ value: farmer.id, label: farmerName(farmer) }))}
          />
        </label>
        <div className="sm:col-span-2">
          <PrimaryButton type="submit">บันทึกกลุ่ม</PrimaryButton>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-frame bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">สมาชิก · {members.length} คน</div>
        <SecondaryButton className="h-9" onClick={() => setMoving(true)}>
          จัดเข้ากลุ่ม
        </SecondaryButton>
      </div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["คู่ค้า", "เบอร์โทร", "พันธุ์", ""].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
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
              <tr key={farmer.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                <td className="px-5 py-3">{farmer.tel}</td>
                <td className="px-5 py-3">{farmerVarieties(plots, farmer.id)}</td>
                <td className="px-5 py-3 text-right">
                  {leadsGroup ? (
                    <span className="text-[12px] font-bold text-ink/50">หัวหน้ากลุ่ม</span>
                  ) : (
                    <button
                      type="button"
                      className="font-bold text-link underline"
                      onClick={() =>
                        setNotice({
                          tone: "confirm",
                          message: `ยืนยันให้ ${farmerName(farmer)} ออกจากกลุ่ม`,
                          accept: () => setNotice(reported(assignFarmer(farmer.id, null), "ออกจากกลุ่มแล้ว")),
                        })
                      }
                    >
                      ออกจากกลุ่ม
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />
      {moving && <MoveFarmer groupId={group.id} onClose={() => setMoving(false)} onAssign={assignFarmer} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

function MemberDetail({ farmer, onClose, onAddRound }: { farmer: Farmer; onClose: () => void; onAddRound: (plotId: string) => void }) {
  const { groups, plots, plantings, updateFarmer } = useMill();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(farmer.firstName);
  const [lastName, setLastName] = useState(farmer.lastName);
  const [tel, setTel] = useState(farmer.tel);
  const [groupId, setGroupId] = useState(farmer.groupId ?? "");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fields = plots.filter((plot) => plot.farmerId === farmer.id);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const leads = groups.find((item) => item.leaderId === farmer.id) ?? null;

  useEffect(() => {
    setEditing(false);
    setFirstName(farmer.firstName);
    setLastName(farmer.lastName);
    setTel(farmer.tel);
    setGroupId(farmer.groupId ?? "");
  }, [farmer.id, farmer.firstName, farmer.lastName, farmer.tel, farmer.groupId]);

  const dirty =
    firstName !== farmer.firstName ||
    lastName !== farmer.lastName ||
    tel !== farmer.tel ||
    (groupId || null) !== farmer.groupId;

  function undoOrCancel() {
    setFirstName(farmer.firstName);
    setLastName(farmer.lastName);
    setTel(farmer.tel);
    setGroupId(farmer.groupId ?? "");
    if (!dirty) setEditing(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดสมาชิก
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
              : "ยืนยันบันทึกข้อมูลสมาชิก";
            setNotice({
              tone: "confirm",
              message,
              accept: () =>
                setNotice(
                  reported(
                    updateFarmer(farmer.id, { firstName, lastName, tel, groupId: nextGroup }),
                    moving ? "ย้ายกลุ่มแล้ว" : "บันทึกสมาชิกแล้ว",
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
            <input value={tel} disabled={!editing} onChange={(event) => setTel(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
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
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            {editing ? (
              <>
                <SecondaryButton type="button" onClick={undoOrCancel}>
                  {dirty ? "เลิกทำ" : "ยกเลิก"}
                </SecondaryButton>
                <PrimaryButton type="submit">บันทึก</PrimaryButton>
              </>
            ) : (
              <SecondaryButton type="button" onClick={() => setEditing(true)}>
                แก้ไข
              </SecondaryButton>
            )}
          </div>
        </form>
      <MemberStanding farmer={farmer} plots={fields} plantings={plantings} leads={leads} />
      <PlotTable plots={fields} plantings={plantings} farmerId={farmer.id} onAddRound={onAddRound} />
      <ReceivedRounds plots={fields} plantings={plantings} />
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
function MemberStanding({ farmer, plots, plantings, leads }: { farmer: Farmer; plots: Plot[]; plantings: Planting[]; leads: SupplierGroup | null }) {
  const { groups } = useMill();
  const group = groups.find((item) => item.id === farmer.groupId) ?? null;
  const area = plots.reduce((sum, plot) => sum + plot.areaRai, 0);
  const plotIds = new Set(plots.map((plot) => plot.id));
  const waiting = plantings.filter((planting) => plotIds.has(planting.plotId) && !planting.delivered).reduce((sum, planting) => sum + planting.estKg, 0);

  return (
    <div className="border-b border-frame">
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">สถานะรับซื้อ</div>
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="รับเข้าแล้ว" value={formatKg(farmer.deliveredKg)} />
        <Fact label="คงค้างจ่าย" value={farmer.unpaidBaht === 0 ? "จ่ายแล้ว" : formatBaht(farmer.unpaidBaht)} />
        <Fact label="พื้นที่" value={plots.length === 0 ? "ยังไม่มีแปลง" : `${area} ไร่ · ${plots.length} แปลง`} />
        <Fact label="ยังไม่เข้า" value={formatKg(waiting)} />
      </div>
      {!leads && (
        <div className="border-t border-frame px-6 py-4 text-[14px]">
          {group ? (
            <span className="font-bold">สมาชิก {group.name}</span>
          ) : (
            <>
              <span className="font-bold">ยังไม่ได้จัดกลุ่ม</span>
              <span> เลือกกลุ่มในแบบฟอร์มด้านบนแล้วบันทึก</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function plotHarvest(planting: Planting | null) {
  if (!planting) return { label: "ยังไม่มีแผน", className: "text-ink/60" };
  if (planting.delivered) return { label: "รับแล้ว", className: "text-ok" };
  const left = daysUntil(planting.harvestOn);
  if (left <= 0) return { label: "ถึงกำหนด", className: "text-brand" };
  if (left <= 7) return { label: "ใกล้เก็บเกี่ยว", className: "text-brand" };
  return { label: `อีก ${left} วัน`, className: "" };
}

function PlotTable({
  plots,
  plantings,
  farmerId,
  onAddRound,
}: {
  plots: Plot[];
  plantings: Planting[];
  farmerId: string;
  onAddRound: (plotId: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">แปลงของสมาชิก</div>
        <Link href={`/map?farmer=${farmerId}`} className="text-[14px] font-bold underline">
          ดูบนแผนที่
        </Link>
      </div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["แปลง", "พื้นที่", "พันธุ์", "วันปลูก", "กำหนดเก็บ", "ที่คาด", "สถานะ", ""].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plots.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-6 text-ink/60">
                ยังไม่มีแปลง
              </td>
            </tr>
          )}
          {plots.map((plot, index) => {
            const round = openPlanting(plantings, plot.id);
            const harvest = plotHarvest(round);
            return (
              <tr key={plot.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                <td className="px-5 py-3">{plot.variety}</td>
                <td className="px-5 py-3">{round ? formatThaiDate(round.plantedOn) : "—"}</td>
                <td className="px-5 py-3">{round ? formatThaiDate(round.harvestOn) : "—"}</td>
                <td className="px-5 py-3">{round ? formatKg(round.estKg) : "—"}</td>
                <td className={`px-5 py-3 font-bold ${harvest.className}`}>{harvest.label}</td>
                <td className="px-5 py-3 text-right">
                  {!round && (
                    <button type="button" className="font-bold text-link underline" onClick={() => onAddRound(plot.id)}>
                      เพิ่มรอบ
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReceivedRounds({ plots, plantings }: { plots: Plot[]; plantings: Planting[] }) {
  const plotNames = new Map(plots.map((plot) => [plot.id, plot.name]));
  const rows = plantings
    .filter((planting) => planting.delivered && plotNames.has(planting.plotId))
    .slice()
    .sort((a, b) => b.harvestOn.localeCompare(a.harvestOn));

  return (
    <div>
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">รอบที่รับแล้ว</div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["แปลง", "วันปลูก", "กำหนดเก็บ", "ที่คาด"].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-6 text-ink/60">
                ยังไม่มีรอบที่รับแล้ว
              </td>
            </tr>
          )}
          {rows.map((round, index) => (
            <tr key={round.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
              <td className="px-5 py-3 font-bold">{plotNames.get(round.plotId)}</td>
              <td className="px-5 py-3">{formatThaiDate(round.plantedOn)}</td>
              <td className="px-5 py-3">{formatThaiDate(round.harvestOn)}</td>
              <td className="px-5 py-3">{formatKg(round.estKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function plantingMark(planting: Planting) {
  if (planting.delivered) return { label: "รับแล้ว", className: "text-ok" };
  if (daysUntil(planting.plantedOn) > 0) return { label: "วางแผน", className: "" };
  return { label: "ปลูกแล้ว", className: "text-brand" };
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
  const { plots, plantings, addPlot } = useMill();
  const owned = plots.filter((plot) => plot.farmerId === farmer.id).slice().sort((a, b) => a.name.localeCompare(b.name, "th"));
  const [plotId, setPlotId] = useState<string | null>(initialPlotId);
  const [adding, setAdding] = useState(false);
  const fields = owned.filter((plot) => openPlanting(plantings, plot.id) || plot.id === plotId);
  const selected = owned.find((plot) => plot.id === plotId) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">แผนการปลูก · {farmerName(farmer)}</div>
        <div className="flex items-center gap-3">
          <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
            เพิ่มแปลง
          </SecondaryButton>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
              ปิด
            </button>
          )}
        </div>
      </div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["แปลง", "พื้นที่", "พันธุ์", "สถานะ", "วันปลูก", "กำหนดเก็บ", "ที่คาด"].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-6 text-ink/60">
                {owned.length === 0 ? "ยังไม่มีแปลง" : "ไม่มีรอบที่กำลังปลูก"}
              </td>
            </tr>
          )}
          {fields.map((plot, index) => {
            const round = openPlanting(plantings, plot.id);
            const mark = round ? plantingMark(round) : { label: "ยังไม่มีแผน", className: "text-ink/60" };
            const picked = plot.id === plotId;
            return (
              <tr
                key={plot.id}
                onClick={() => setPlotId(plot.id)}
                className={`cursor-pointer ${picked ? "bg-pick" : index % 2 === 1 ? "bg-table hover:bg-sub" : "bg-white hover:bg-sub"}`}
              >
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                <td className="px-5 py-3">{plot.variety}</td>
                <td className={`px-5 py-3 font-bold ${mark.className}`}>{mark.label}</td>
                <td className="px-5 py-3">{round ? formatThaiDate(round.plantedOn) : "—"}</td>
                <td className="px-5 py-3">{round ? formatThaiDate(round.harvestOn) : "—"}</td>
                <td className="px-5 py-3">{round ? formatKg(round.estKg) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selected && <PlotWorkspace plot={selected} onBack={() => setPlotId(null)} />}
      {adding && (
        <PlotDialog
          title="เพิ่มแปลง"
          name=""
          area=""
          onClose={() => setAdding(false)}
          onSave={(name, areaRai, variety, schedule) => addPlot(farmer.id, { name, areaRai, variety, ...schedule })}
        />
      )}
    </>
  );
}

export function PlotWorkspace({ plot, onBack }: { plot: Plot; onBack: () => void }) {
  const { plantings, savePlot, removePlot, savePlanting, removePlanting } = useMill();
  const history = plantingsOf(plantings, plot.id);
  const current = openPlanting(plantings, plot.id);
  const locked = history.some((round) => round.delivered);
  const mark = current ? plantingMark(current) : null;
  const [name, setName] = useState(plot.name);
  const [area, setArea] = useState(String(plot.areaRai));
  const [variety, setVariety] = useState<Variety>(plot.variety);
  const [plantedOn, setPlantedOn] = useState(current?.plantedOn ?? "");
  const [harvestOn, setHarvestOn] = useState(current?.harvestOn ?? "");
  const [estKg, setEstKg] = useState(current ? String(current.estKg) : "");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fieldClass = `${inputClass} mt-1`;

  useEffect(() => {
    setName(plot.name);
    setArea(String(plot.areaRai));
    setVariety(plot.variety);
    setPlantedOn(current?.plantedOn ?? "");
    setHarvestOn(current?.harvestOn ?? "");
    setEstKg(current ? String(current.estKg) : "");
  }, [plot.id, plot.name, plot.areaRai, plot.variety, current?.id, current?.plantedOn, current?.harvestOn, current?.estKg]);

  return (
    <>
      <div className="border-t border-frame bg-bar px-6 py-4 text-[16px] font-bold text-white">
        แก้ไข {plot.name}
        {mark ? ` · ${mark.label}` : ""}
      </div>
      <form
        className="grid gap-4 border-b border-frame px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
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
          if (!Number.isInteger(nextKg) || nextKg <= 0) {
            setNotice({ tone: "error", message: "ที่คาดต้องเป็นจำนวนเต็มมากกว่า 0" });
            return;
          }
          setNotice({
            tone: "confirm",
            message: `ยืนยันบันทึก ${name.trim()}`,
            accept: () => {
              const plotError = savePlot(plot.id, { name, areaRai, variety });
              if (plotError) {
                setNotice({ tone: "error", message: plotError });
                return;
              }
              setNotice(
                reported(
                  savePlanting(plot.id, { plantingId: current?.id ?? null, plantedOn, harvestOn, estKg: nextKg }),
                  "บันทึกแล้ว",
                ),
              );
            },
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อแปลง
          <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พื้นที่ (ไร่)
          <input value={area} inputMode="decimal" onChange={(event) => setArea(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พันธุ์
          <select value={variety} onChange={(event) => setVariety(event.target.value as Variety)} className={fieldClass}>
            {VARIETIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          วันปลูก
          <input type="date" value={plantedOn} onChange={(event) => setPlantedOn(event.target.value)} className={fieldClass} required />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          กำหนดเก็บ
          <input type="date" value={harvestOn} onChange={(event) => setHarvestOn(event.target.value)} className={fieldClass} required />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
          ที่คาด (กก.)
          <input value={estKg} inputMode="numeric" onChange={(event) => setEstKg(event.target.value)} className={fieldClass} />
        </label>
        {locked && <p className="text-[14px] sm:col-span-2">รอบที่รับแล้วอยู่ที่รายละเอียดสมาชิก</p>}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <PrimaryButton type="submit">บันทึก</PrimaryButton>
          {current && (
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบแผนรอบ ${formatThaiDate(current.plantedOn)}`,
                  accept: () => setNotice(reported(removePlanting(current.id), "ลบแผนแล้ว")),
                })
              }
            >
              ลบแผน
            </SecondaryButton>
          )}
          {!locked && (
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบแปลง ${plot.name}`,
                  accept: () => setNotice(reported(removePlot(plot.id), "ลบแปลงแล้ว", onBack)),
                })
              }
            >
              ลบแปลง
            </SecondaryButton>
          )}
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

function PlotDialog({
  title,
  name,
  area,
  schedule = true,
  onClose,
  onSave,
}: {
  title: string;
  name: string;
  area: string;
  schedule?: boolean;
  onClose: () => void;
  onSave: (name: string, areaRai: number, variety: Variety, schedule: { plantedOn: string; harvestOn: string; estKg: number }) => string | null;
}) {
  const [plotName, setPlotName] = useState(name);
  const [areaRai, setAreaRai] = useState(area);
  const [variety, setVariety] = useState<Variety>("หอมมะลิ");
  const [plantedOn, setPlantedOn] = useState("");
  const [harvestOn, setHarvestOn] = useState("");
  const [estKg, setEstKg] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

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
            if (!Number.isFinite(nextArea) || nextArea <= 0) {
              setNotice({ tone: "error", message: "พื้นที่ต้องมากกว่า 0" });
              return;
            }
            if (schedule && (!Number.isInteger(nextKg) || nextKg <= 0)) {
              setNotice({ tone: "error", message: "ที่คาดต้องเป็นจำนวนเต็มมากกว่า 0" });
              return;
            }
            setNotice({
              tone: "confirm",
              message: `ยืนยัน${title}`,
              accept: () =>
                setNotice(
                  reported(onSave(plotName, nextArea, variety, { plantedOn, harvestOn, estKg: nextKg }), schedule ? "บันทึกแปลงแล้ว" : "แก้แปลงแล้ว", onClose),
                ),
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อแปลง
            <input value={plotName} onChange={(event) => setPlotName(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พื้นที่ (ไร่)
            <input value={areaRai} inputMode="decimal" onChange={(event) => setAreaRai(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พันธุ์
            <select value={variety} onChange={(event) => setVariety(event.target.value as Variety)} className={`${inputClass} mt-1`}>
              {VARIETIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {schedule && (
            <>
              <label className="block text-[14px] font-bold leading-[1.4]">
                วันปลูก
                <input type="date" value={plantedOn} onChange={(event) => setPlantedOn(event.target.value)} className={`${inputClass} mt-1`} required />
              </label>
              <label className="block text-[14px] font-bold leading-[1.4]">
                กำหนดเก็บ
                <input type="date" value={harvestOn} onChange={(event) => setHarvestOn(event.target.value)} className={`${inputClass} mt-1`} required />
              </label>
              <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
                ที่คาด (กก.)
                <input value={estKg} inputMode="numeric" onChange={(event) => setEstKg(event.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </>
          )}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
            <PrimaryButton type="submit">บันทึก</PrimaryButton>
          </div>
        </form>
      </Dialog>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
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
  onCreate: (name: string, leaderId: string) => string | null;
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
              accept: () => setNotice(reported(onCreate(name, leaderId), "สร้างกลุ่มแล้ว", onClose)),
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
            <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
            <PrimaryButton type="submit">บันทึก</PrimaryButton>
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
  onAssign: (farmerId: string, groupId: string) => string | null;
}) {
  const { farmers, groups } = useMill();
  const [farmerId, setFarmerId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const person = farmers.find((farmer) => farmer.id === farmerId);
  const groupName = groups.find((group) => group.id === groupId)?.name ?? "กลุ่ม";
  return (
    <>
      <Dialog title="จัดเข้ากลุ่ม" onClose={onClose}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!person) {
              setNotice({ tone: "error", message: "เลือกคู่ค้า" });
              return;
            }
            setNotice({
              tone: "confirm",
              message: `ยืนยันจัด ${farmerName(person)} เข้า${groupName}`,
              accept: () => setNotice(reported(onAssign(person.id, groupId), "จัดเข้ากลุ่มแล้ว", onClose)),
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            คู่ค้า
            <div className="mt-1">
              <FarmerSelect value={farmerId} onChange={setFarmerId} />
            </div>
          </label>
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
            <PrimaryButton type="submit">บันทึก</PrimaryButton>
          </div>
        </form>
      </Dialog>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
