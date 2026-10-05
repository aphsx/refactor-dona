"use client";

import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { useMill } from "@/components/store";
import { useServerPage } from "@/components/server-page";
import { api } from "@/lib/api";
import { ConfirmAlert, Glyph, PageHeader, Pagination, PrimaryButton, ResultAlert, SearchSelect, SecondaryButton, SortableTh, TableScroll, inputClass, orderBy, tableClass, useTableSort } from "@/components/ui";
import { farmerName, personRole, roleTitle, type Farmer, type PermissionRole } from "@/lib/mill";

const ROLE_OPTIONS: { value: PermissionRole; label: string }[] = [
  { value: "mill", label: "โรงสี" },
  { value: "leader", label: "หัวหน้ากลุ่ม" },
  { value: "member", label: "สมาชิก" },
];

type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string };

export function PeoplePermissionsScreen() {
  const { groups, roleGrants, revision, farmerPage } = useMill();
  const [draftName, setDraftName] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const listingSort = useTableSort(name);
  const page = useServerPage(
    `${name}:${revision}`,
    (pageNo, pageSize) => api.listFarmersPage({ q: name, page: pageNo, pageSize }),
    name === "" ? farmerPage : null,
  );
  const ordered = orderBy(page.rows, listingSort.sort, (farmer, key) => {
    if (key === "tel") return farmer.tel;
    if (key === "group") return farmer.groupName || groups.find((group) => group.id === farmer.groupId)?.name || "";
    if (key === "role") return roleTitle(personRole(roleGrants, groups, farmer.id));
    if (key === "scope") return scopeLabel(personRole(roleGrants, groups, farmer.id), groups, farmer.id);
    return farmerName(farmer);
  });

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="รายคน" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหา</div>
        <form
          className="flex flex-wrap items-end gap-3 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            setName(draftName);
          }}
        >
          <label className="block min-w-[240px] flex-1 text-[14px] font-bold leading-[1.4]">
            ชื่อหรือเบอร์โทร
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <PrimaryButton type="submit">
            <Glyph icon={Search} />
            ค้นหา
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setDraftName("");
              setName("");
            }}
          >
            <Glyph icon={RotateCcw} />
            ล้าง
          </SecondaryButton>
        </form>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">รายคน</div>
        <TableScroll>
          <table className={tableClass}>
            <thead className="bg-table">
              <tr>
                <SortableTh label="เกษตรกร" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="เบอร์โทร" column="tel" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="ยศ" column="role" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="จัดการได้" column="scope" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <th className="px-5 py-3 font-bold">ย้ายหรือยกเลิก</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((farmer, index) => (
                <PersonRow key={farmer.id} farmer={farmer} stripe={index % 2 === 1} onNotice={setNotice} />
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
      </div>
      {notice?.tone === "confirm" && (
        <ConfirmAlert message={notice.message} onCancel={() => setNotice(null)} onConfirm={notice.accept} />
      )}
      {notice && notice.tone !== "confirm" && (
        <ResultAlert kind={notice.tone} message={notice.message} onClose={() => setNotice(null)} />
      )}
    </div>
  );
}

function PersonRow({
  farmer,
  stripe,
  onNotice,
}: {
  farmer: Farmer;
  stripe: boolean;
  onNotice: (notice: Notice) => void;
}) {
  const { groups, roleGrants, assignRole, revokeRole } = useMill();
  const current = personRole(roleGrants, groups, farmer.id);
  const [next, setNext] = useState<PermissionRole>(current);
  const grantedMill = roleGrants.some((grant) => grant.farmerId === farmer.id);
  const group = groups.find((item) => item.id === farmer.groupId) ?? null;

  function move() {
    const name = farmerName(farmer);
    const message =
      next === "leader" && group && group.leaderId !== farmer.id
        ? `ยืนยันย้ายหัวหน้า${group.name} เป็น ${name}`
        : `ยืนยันให้ ${name} เป็น${roleTitle(next)}`;
    onNotice({
      tone: "confirm",
      message,
      accept: async () => onNotice(await reported(assignRole(farmer.id, next), "ย้ายสิทธิ์แล้ว")),
    });
  }

  function revoke() {
    onNotice({
      tone: "confirm",
      message: `ยืนยันยกเลิกยศโรงสีของ ${farmerName(farmer)}`,
      accept: async () => onNotice(await reported(revokeRole(farmer.id), "ยกเลิกสิทธิ์แล้ว")),
    });
  }

  return (
    <tr className={stripe ? "bg-table" : "bg-white"}>
      <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
      <td className="px-5 py-3">{farmer.tel}</td>
      <td className="px-5 py-3">{farmer.groupName || group?.name || "—"}</td>
      <td className="px-5 py-3">{roleTitle(current)}</td>
      <td className="px-5 py-3">{scopeLabel(current, groups, farmer.id)}</td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchSelect
            label={`ยศของ ${farmerName(farmer)}`}
            className="w-40"
            value={next}
            onChange={(value) => setNext((value || "member") as PermissionRole)}
            options={ROLE_OPTIONS}
          />
          <SecondaryButton className="h-9" onClick={move}>
            ย้ายสิทธิ์
          </SecondaryButton>
          <SecondaryButton className="h-9" disabled={!grantedMill} onClick={revoke}>
            ยกเลิกสิทธิ์
          </SecondaryButton>
        </div>
      </td>
    </tr>
  );
}

function scopeLabel(role: PermissionRole, groups: { id: string; name: string; leaderId: string }[], farmerId: string) {
  if (role === "mill") return "ทั้งโรงสี";
  if (role === "leader") return groups.find((group) => group.leaderId === farmerId)?.name ?? "กลุ่มตัวเอง";
  return "ของตัวเอง";
}

async function reported(error: Promise<string | null> | string | null, success: string): Promise<Notice> {
  const message = await error;
  return message ? { tone: "error", message } : { tone: "success", message: success };
}
