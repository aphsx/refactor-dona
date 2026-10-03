"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { CanAdd } from "@/components/can";
import { PlaceSelects } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { Dialog, Glyph, PageHeader, Pagination, PrimaryButton, SearchSelect, SecondaryButton, SortableTh, TableScroll, inputClass, orderBy, tableClass, usePagination, useTableSort } from "@/components/ui";
import { farmerName, farmerVarieties, formatKg } from "@/lib/mill";

export function FarmersScreen() {
  const { farmers, plots, plantings, groups } = useMill();
  const [adding, setAdding] = useState(false);
  const listingSort = useTableSort();
  const ordered = orderBy(farmers, listingSort.sort, (farmer, key) => {
    if (key === "name") return farmerName(farmer);
    if (key === "tel") return farmer.tel;
    if (key === "group") return groups.find((group) => group.id === farmer.groupId)?.name ?? "";
    if (key === "variety") return farmerVarieties(plots, plantings, farmer.id);
    if (key === "plots") return plots.filter((plot) => plot.farmerId === farmer.id).length;
    return farmer.deliveredKg;
  });
  const page = usePagination(ordered);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="เกษตรกร" />
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
          บัญชีรับซื้อ
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-normal">{farmers.length} คน</span>
            <CanAdd resource="farmers">
              <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
                <Glyph icon={Plus} />
                เพิ่มเกษตรกร
              </SecondaryButton>
            </CanAdd>
          </div>
        </div>
        <TableScroll>
<table className={tableClass}>
          <thead className="bg-table">
          <tr>
              <SortableTh label="เกษตรกร" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="เบอร์โทร" column="tel" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="รับเข้าแล้ว" column="delivered" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="แปลง" column="plots" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((farmer, index) => {
              const fieldCount = plots.filter((plot) => plot.farmerId === farmer.id).length;
              return (
                <tr key={farmer.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                  <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                  <td className="px-5 py-3">{farmer.tel}</td>
                  <td className="px-5 py-3">{groups.find((group) => group.id === farmer.groupId)?.name ?? "—"}</td>
                  <td className="px-5 py-3">{farmerVarieties(plots, plantings, farmer.id)}</td>
                  <td className="px-5 py-3">{formatKg(farmer.deliveredKg)}</td>
                  <td className="px-5 py-3">{fieldCount}</td>
                  <td className="px-5 py-3">
                    <Link href={`/map?farmer=${farmer.id}`} className="font-bold text-link underline">
                      ดูแปลง
                    </Link>
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
      </div>
      {adding && <AddFarmer onClose={() => setAdding(false)} />}
    </div>
  );
}

function RequiredMark() {
  return <span className="text-danger"> *</span>;
}

function AddFarmer({ onClose }: { onClose: () => void }) {
  const { groups, createFarmer } = useMill();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tel, setTel] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog title="เพิ่มเกษตรกร" onClose={onClose}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = createFarmer({
            firstName,
            lastName,
            tel,
            address,
            subdistrict,
            district,
            province,
            groupId: groupId || null,
          });
          if (message) {
            setError(message);
            return;
          }
          onClose();
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
          province={province}
          district={district}
          subdistrict={subdistrict}
          onChange={(place) => {
            setProvince(place.province);
            setDistrict(place.district);
            setSubdistrict(place.subdistrict);
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
