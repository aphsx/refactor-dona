"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMill } from "@/components/store";
import { Dialog, FarmerSelect, PageHeader, Pagination, PrimaryButton, SecondaryButton, StatusTab, ConfirmAlert, ResultAlert, inputClass, usePagination } from "@/components/ui";
import { farmerName, formatBaht, formatKg, formatThaiDate, type Farmer, type Plot, type SupplierGroup, type Variety } from "@/lib/mill";

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
  const { groups, farmers, plots, createGroup } = useMill();
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
              <select value={draftLeader} onChange={(event) => setDraftLeader(event.target.value)} className={`${inputClass} mt-1`}>
                <option value="">ทั้งหมด</option>
                {farmers.map((farmer) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmerName(farmer)}
                  </option>
                ))}
              </select>
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
                  const expected = plots.filter((plot) => ids.has(plot.farmerId) && !plot.delivered).reduce((sum, plot) => sum + plot.estKg, 0);
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
  const { groups, farmers, assignFarmer } = useMill();
  const [tab, setTab] = useState<"listing" | "detail">("listing");
  const [draftName, setDraftName] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
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
    setTab("detail");
  }

  function closeDetail() {
    setDetailId(null);
    setTab("listing");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการสมาชิก" />
      <div className="flex items-end gap-1">
        <StatusTab label="จัดการสมาชิก" active={tab === "listing"} onClick={closeDetail} />
        {tab === "detail" && detail && (
          <span className="flex h-10 items-center rounded-t-[6px] bg-bar px-4 text-[14px] font-bold text-white">รายละเอียดสมาชิก</span>
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
              <select value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} className={`${inputClass} mt-1`}>
                <option value="">ทั้งหมด</option>
                <option value="none">ไม่มีกลุ่ม</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
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
                      <td className="px-5 py-3">{farmer.variety}</td>
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
        {tab === "detail" && detail && <MemberDetail farmer={detail} onClose={closeDetail} />}
      </div>
      {moving && assignGroupId && <MoveFarmer groupId={assignGroupId} onClose={() => setMoving(false)} onAssign={assignFarmer} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}

function GroupDirectory() {
  const { groups, farmers, plots } = useMill();
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
            const expected = plots.filter((plot) => ids.has(plot.farmerId) && !plot.delivered).reduce((sum, plot) => sum + plot.estKg, 0);
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
  const { farmers, updateGroup, assignFarmer } = useMill();
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
          <select value={draftLeader} onChange={(event) => setDraftLeader(event.target.value)} className={`${inputClass} mt-1`}>
            {members.map((farmer) => (
              <option key={farmer.id} value={farmer.id}>
                {farmerName(farmer)}
              </option>
            ))}
          </select>
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
                <td className="px-5 py-3">{farmer.variety}</td>
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

function MemberDetail({ farmer, onClose }: { farmer: Farmer; onClose: () => void }) {
  const { groups, plots, updateFarmer } = useMill();
  const varieties: Variety[] = ["หอมมะลิ", "ขาว", "เหนียว"];
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(farmer.firstName);
  const [lastName, setLastName] = useState(farmer.lastName);
  const [tel, setTel] = useState(farmer.tel);
  const [variety, setVariety] = useState<Variety>(farmer.variety);
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
    setVariety(farmer.variety);
    setGroupId(farmer.groupId ?? "");
  }, [farmer.id, farmer.firstName, farmer.lastName, farmer.tel, farmer.variety, farmer.groupId]);

  const dirty =
    firstName !== farmer.firstName ||
    lastName !== farmer.lastName ||
    tel !== farmer.tel ||
    variety !== farmer.variety ||
    (groupId || null) !== farmer.groupId;

  function undoOrCancel() {
    setFirstName(farmer.firstName);
    setLastName(farmer.lastName);
    setTel(farmer.tel);
    setVariety(farmer.variety);
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
                    updateFarmer(farmer.id, { firstName, lastName, tel, variety, groupId: nextGroup }),
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
          <label className="block text-[14px] font-bold leading-[1.4]">
            พันธุ์
            <select value={variety} disabled={!editing} onChange={(event) => setVariety(event.target.value as Variety)} className={fieldClass}>
              {varieties.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
            กลุ่ม
            <select value={groupId} disabled={!editing} onChange={(event) => setGroupId(event.target.value)} className={fieldClass}>
              <option value="">ไม่มีกลุ่ม</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
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
      <div className="grid gap-6 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 text-[14px]">
          {leads && <Fact label="หน้าที่" value={`หัวหน้า ${leads.name}`} />}
          <Fact label="รับเข้าแล้ว" value={formatKg(farmer.deliveredKg)} />
          <Fact label="คงค้างจ่าย" value={farmer.unpaidBaht === 0 ? "จ่ายแล้ว" : formatBaht(farmer.unpaidBaht)} />
          <Link href={`/map?farmer=${farmer.id}`} className="inline-block font-bold text-link underline">
            ดูบนแผนที่
          </Link>
        </div>
        <PlotTable plots={fields} />
      </div>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
function PlotTable({ plots }: { plots: Plot[] }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-frame">
      <div className="bg-table px-5 py-3 text-[14px] font-bold">แปลงของสมาชิก</div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr>
            {["แปลง", "พื้นที่", "วันปลูก", "กำหนดเก็บ", "ที่คาด"].map((label) => (
              <th key={label} className="border-t border-white bg-table px-5 py-3 font-bold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plots.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-ink/60">
                ยังไม่มีแปลง
              </td>
            </tr>
          )}
          {plots.map((plot, index) => (
            <tr key={plot.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
              <td className="px-5 py-3 font-bold">{plot.name}</td>
              <td className="px-5 py-3">{plot.areaRai} ไร่</td>
              <td className="px-5 py-3">{formatThaiDate(plot.plantedOn)}</td>
              <td className="px-5 py-3">{formatThaiDate(plot.harvestOn)}</td>
              <td className="px-5 py-3">{plot.delivered ? "รับแล้ว" : formatKg(plot.estKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
