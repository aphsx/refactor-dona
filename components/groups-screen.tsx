"use client";

import { useState } from "react";
import { useMill } from "@/components/store";
import { Dialog, FarmerSelect, PageHeader, Pagination, PrimaryButton, SecondaryButton, inputClass, usePagination } from "@/components/ui";
import { farmerName, formatKg } from "@/lib/mill";

export function GroupsScreen() {
  const { groups, subgroups, farmers, plots, createGroup, createSubgroup, assignFarmer } = useMill();
  const [selectedId, setSelectedId] = useState(groups[0]?.id ?? "");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);
  const [moving, setMoving] = useState(false);
  const selected = groups.find((group) => group.id === selectedId) ?? groups[0];
  const groupPage = usePagination(groups);
  const groupSubs = subgroups.filter((item) => item.groupId === selected?.id);
  const members = farmers.filter((farmer) => farmer.groupId === selected?.id);
  const subPage = usePagination(groupSubs, selected?.id ?? "");
  const memberPage = usePagination(members, selected?.id ?? "");

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader
        current="กลุ่ม"
        action={
          <PrimaryButton onClick={() => setCreatingGroup(true)}>สร้างกลุ่ม</PrimaryButton>
        }
      />
      <section className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">กลุ่มรับซื้อ</div>
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
            {groupPage.rows.map((group, index) => {
              const leader = farmers.find((farmer) => farmer.id === group.leaderId);
              const people = farmers.filter((farmer) => farmer.groupId === group.id);
              const ids = new Set(people.map((farmer) => farmer.id));
              const expected = plots
                .filter((plot) => ids.has(plot.farmerId) && !plot.delivered)
                .reduce((sum, plot) => sum + plot.estKg, 0);
              const received = people.reduce((sum, farmer) => sum + farmer.deliveredKg, 0);
              const active = group.id === selected?.id;
              return (
                <tr key={group.id} className={active ? "bg-pick" : index % 2 === 1 ? "bg-table" : "bg-white"}>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setSelectedId(group.id)} className="font-bold underline">
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
          page={groupPage.page}
          pageCount={groupPage.pageCount}
          pageSize={groupPage.pageSize}
          total={groupPage.total}
          onPageChange={groupPage.setPage}
          onPageSizeChange={groupPage.setPageSize}
        />
      </section>

      {selected && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-[8px] border border-frame">
            <div className="flex items-center justify-between bg-bar px-6 py-4 text-[16px] font-bold text-white">
              กลุ่มย่อยของ {selected.name}
              <PrimaryButton className="h-9" onClick={() => setCreatingSubgroup(true)}>
                สร้างกลุ่มย่อย
              </PrimaryButton>
            </div>
            <table className="w-full border-collapse text-left text-[14px]">
              <thead className="bg-table">
                <tr>
                  {["กลุ่มย่อย", "หัวหน้า", "สมาชิก"].map((label) => (
                    <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subPage.rows.map((item, index) => {
                  const leader = farmers.find((farmer) => farmer.id === item.leaderId);
                  const count = farmers.filter((farmer) => farmer.subgroupId === item.id).length;
                  return (
                    <tr key={item.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                      <td className="px-5 py-3 font-bold">{item.name}</td>
                      <td className="px-5 py-3">{leader ? farmerName(leader) : "—"}</td>
                      <td className="px-5 py-3">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={subPage.page}
              pageCount={subPage.pageCount}
              pageSize={subPage.pageSize}
              total={subPage.total}
              onPageChange={subPage.setPage}
              onPageSizeChange={subPage.setPageSize}
            />
          </section>
          <section className="overflow-hidden rounded-[8px] border border-frame">
            <div className="flex items-center justify-between bg-bar px-6 py-4 text-[16px] font-bold text-white">
              สมาชิก
              <SecondaryButton className="h-9" onClick={() => setMoving(true)}>
                จัดเข้ากลุ่ม
              </SecondaryButton>
            </div>
            <table className="w-full border-collapse text-left text-[14px]">
              <thead className="bg-table">
                <tr>
                  {["คู่ค้า", "กลุ่มย่อย", "พันธุ์", ""].map((label) => (
                    <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberPage.rows.map((farmer, index) => (
                  <tr key={farmer.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                    <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                    <td className="px-5 py-3">{subgroups.find((item) => item.id === farmer.subgroupId)?.name ?? "—"}</td>
                    <td className="px-5 py-3">{farmer.variety}</td>
                    <td className="px-5 py-3 text-right">
                      {selected.leaderId === farmer.id || subgroups.some((item) => item.leaderId === farmer.id) ? (
                        <span className="text-[12px] font-bold text-ink/50">หัวหน้า</span>
                      ) : (
                        <button
                          type="button"
                          className="font-bold text-link underline"
                          onClick={() => assignFarmer(farmer.id, null, null)}
                        >
                          ออกจากกลุ่ม
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={memberPage.page}
              pageCount={memberPage.pageCount}
              pageSize={memberPage.pageSize}
              total={memberPage.total}
              onPageChange={memberPage.setPage}
              onPageSizeChange={memberPage.setPageSize}
            />
          </section>
        </div>
      )}

      {creatingGroup && <CreateGroup onClose={() => setCreatingGroup(false)} onCreate={createGroup} />}
      {creatingSubgroup && selected && (
        <CreateSubgroup groupId={selected.id} onClose={() => setCreatingSubgroup(false)} onCreate={createSubgroup} />
      )}
      {moving && selected && (
        <MoveFarmer
          groupId={selected.id}
          onClose={() => setMoving(false)}
          onAssign={assignFarmer}
        />
      )}
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
  const [error, setError] = useState("");
  return (
    <Dialog title="สร้างกลุ่ม" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const message = onCreate(name, leaderId);
          if (message) {
            setError(message);
            return;
          }
          onClose();
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
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">บันทึก</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}

function CreateSubgroup({
  groupId,
  onClose,
  onCreate,
}: {
  groupId: string;
  onClose: () => void;
  onCreate: (groupId: string, name: string, leaderId: string) => string | null;
}) {
  const { farmers } = useMill();
  const members = farmers.filter((farmer) => farmer.groupId === groupId);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState(members[0]?.id ?? "");
  const [error, setError] = useState("");
  return (
    <Dialog title="สร้างกลุ่มย่อย" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const message = onCreate(groupId, name, leaderId);
          if (message) {
            setError(message);
            return;
          }
          onClose();
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อกลุ่มย่อย
          <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          หัวหน้ากลุ่มย่อย
          <select value={leaderId} onChange={(event) => setLeaderId(event.target.value)} className={`${inputClass} mt-1`}>
            {members.map((farmer) => (
              <option key={farmer.id} value={farmer.id}>
                {farmerName(farmer)}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">บันทึก</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}

function MoveFarmer({
  groupId,
  onClose,
  onAssign,
}: {
  groupId: string;
  onClose: () => void;
  onAssign: (farmerId: string, groupId: string, subgroupId: string | null) => string | null;
}) {
  const { subgroups } = useMill();
  const options = subgroups.filter((item) => item.groupId === groupId);
  const [farmerId, setFarmerId] = useState("");
  const [subgroupId, setSubgroupId] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog title="จัดเข้ากลุ่ม" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!farmerId) {
            setError("เลือกคู่ค้า");
            return;
          }
          const message = onAssign(farmerId, groupId, subgroupId || null);
          if (message) {
            setError(message);
            return;
          }
          onClose();
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          คู่ค้า
          <div className="mt-1">
            <FarmerSelect value={farmerId} onChange={setFarmerId} />
          </div>
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          กลุ่มย่อย
          <select value={subgroupId} onChange={(event) => setSubgroupId(event.target.value)} className={`${inputClass} mt-1`}>
            <option value="">ยังไม่เข้ากลุ่มย่อย</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">บันทึก</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
