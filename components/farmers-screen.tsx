"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { CanAdd } from "@/components/can";
import { AddFarmer } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { Glyph, PageHeader, Pagination, SecondaryButton, SortableTh, TableScroll, openRow, orderBy, rowTone, tableClass, usePagination, useTableSort } from "@/components/ui";
import { farmerName, formatKg, personRole, roleTitle } from "@/lib/mill";

export function FarmersScreen() {
  const router = useRouter();
  const { farmers, plots, groups, roleGrants } = useMill();
  const [adding, setAdding] = useState(false);
  const listingSort = useTableSort();
  const ordered = orderBy(farmers, listingSort.sort, (farmer, key) => {
    if (key === "name") return farmerName(farmer);
    if (key === "tel") return farmer.tel;
    if (key === "group") return groups.find((group) => group.id === farmer.groupId)?.name ?? "";
    if (key === "role") return roleTitle(personRole(roleGrants, groups, farmer.id));
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
          <span className="text-[14px] font-normal">{farmers.length} คน</span>
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
              <SortableTh label="แปลง" column="plots" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((farmer, index) => {
              const fieldCount = plots.filter((plot) => plot.farmerId === farmer.id).length;
              return (
                <tr
                  key={farmer.id}
                  onClick={(event) => openRow(event, () => router.push(`/farmers/manage?farmer=${farmer.id}`))}
                  className={rowTone(index)}
                >
                  <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                  <td className="px-5 py-3">{farmer.tel}</td>
                  <td className="px-5 py-3">{groups.find((group) => group.id === farmer.groupId)?.name ?? "—"}</td>
                  <td className="px-5 py-3">{roleTitle(personRole(roleGrants, groups, farmer.id))}</td>
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
        <div className="flex flex-wrap gap-5 px-6 py-4">
          <CanAdd resource="farmers">
            <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
              <Glyph icon={Plus} />
              เพิ่มเกษตรกร
            </SecondaryButton>
          </CanAdd>
        </div>
      </div>
      {adding && <AddFarmer onClose={() => setAdding(false)} />}
    </div>
  );
}
