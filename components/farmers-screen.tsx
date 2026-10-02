"use client";

import Link from "next/link";
import { useMill } from "@/components/store";
import { PageHeader, Pagination, SortableTh, TableScroll, orderBy, tableClass, usePagination, useTableSort } from "@/components/ui";
import { farmerName, farmerVarieties, formatBaht, formatKg } from "@/lib/mill";

export function FarmersScreen() {
  const { farmers, plots, plantings, groups } = useMill();
  const listingSort = useTableSort();
  const ordered = orderBy(farmers, listingSort.sort, (farmer, key) => {
    if (key === "name") return farmerName(farmer);
    if (key === "tel") return farmer.tel;
    if (key === "group") return groups.find((group) => group.id === farmer.groupId)?.name ?? "";
    if (key === "variety") return farmerVarieties(plots, plantings, farmer.id);
    if (key === "paid") return farmer.unpaidBaht;
    if (key === "plots") return plots.filter((plot) => plot.farmerId === farmer.id).length;
    return farmer.deliveredKg;
  });
  const page = usePagination(ordered);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="คู่ค้า" />
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">บัญชีรับซื้อ</div>
        <TableScroll>
<table className={tableClass}>
          <thead className="bg-table">
          <tr>
              <SortableTh label="คู่ค้า" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="เบอร์โทร" column="tel" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="รับเข้าแล้ว" column="delivered" sort={listingSort.sort} onSort={listingSort.toggleSort} />
              <SortableTh label="คงค้างจ่าย" column="paid" sort={listingSort.sort} onSort={listingSort.toggleSort} />
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
                  <td className="px-5 py-3">{farmer.unpaidBaht === 0 ? "จ่ายแล้ว" : formatBaht(farmer.unpaidBaht)}</td>
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
    </div>
  );
}
