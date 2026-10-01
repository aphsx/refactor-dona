"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useMill } from "@/components/store";
import { PageHeader, Pagination, usePagination } from "@/components/ui";
import { farmerName, formatBaht, formatKg } from "@/lib/mill";

export function FarmersScreen() {
  const { farmers, plots, groups, subgroups } = useMill();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return farmers.filter((farmer) => {
      const haystack = `${farmerName(farmer)} ${farmer.tel}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [farmers, query]);
  const page = usePagination(rows, query);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="คู่ค้า" />
      <div className="relative mb-6 max-w-sm">
        <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นชื่อหรือเบอร์โทร"
          aria-label="ค้นคู่ค้า"
          className="h-10 w-full rounded-[4px] border border-line bg-white pl-9 pr-3 text-[14px] placeholder:text-ink/20"
        />
      </div>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">บัญชีรับซื้อ</div>
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="bg-table">
            <tr>
              {["คู่ค้า", "เบอร์โทร", "กลุ่ม", "กลุ่มย่อย", "พันธุ์", "รับเข้าแล้ว", "คงค้างจ่าย", "แปลง", ""].map((label) => (
                <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                  {label}
                </th>
              ))}
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
                  <td className="px-5 py-3">{subgroups.find((item) => item.id === farmer.subgroupId)?.name ?? "—"}</td>
                  <td className="px-5 py-3">{farmer.variety}</td>
                  <td className="px-5 py-3">{formatKg(farmer.deliveredKg)}</td>
                  <td className="px-5 py-3">{farmer.unpaidBaht === 0 ? "จ่ายแล้ว" : formatBaht(farmer.unpaidBaht)}</td>
                  <td className="px-5 py-3">{fieldCount}</td>
                  <td className="px-5 py-3">
                    <Link href={`/supply?farmer=${farmer.id}`} className="font-bold text-link underline">
                      ดูแปลง
                    </Link>
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
      </div>
    </div>
  );
}
