"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMill } from "@/components/store";
import { Kpi, PageHeader, Pagination, inputClass, usePagination } from "@/components/ui";
import { farmerName, formatKg, formatThaiDate, formatThaiMonth, type Plot } from "@/lib/mill";

type SeasonRow = Plot & { plantingId: string; plantedOn: string; harvestOn: string; estKg: number };

export function PlanScreen() {
  const { plots, plantings, farmers, groups } = useMill();
  const [groupId, setGroupId] = useState("all");

  const rows = useMemo(() => {
    return plantings
      .filter((planting) => !planting.delivered)
      .flatMap((planting) => {
        const plot = plots.find((item) => item.id === planting.plotId);
        if (!plot) return [];
        const farmer = farmers.find((item) => item.id === plot.farmerId);
        if (groupId === "none" && farmer?.groupId != null) return [];
        if (groupId !== "all" && groupId !== "none" && farmer?.groupId !== groupId) return [];
        return [{ ...plot, plantingId: planting.id, plantedOn: planting.plantedOn, harvestOn: planting.harvestOn, estKg: planting.estKg }];
      })
      .sort((a, b) => a.plantedOn.localeCompare(b.plantedOn));
  }, [plantings, plots, farmers, groupId]);

  const months = useMemo(() => groupByMonth(rows), [rows]);
  const page = usePagination(months, groupId);
  const area = rows.reduce((sum, plot) => sum + plot.areaRai, 0);
  const expected = rows.reduce((sum, plot) => sum + plot.estKg, 0);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="แผนรอบปลูก" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <Kpi label="พื้นที่ปลูกรอบนี้" value={`${area} ไร่`} />
        <Kpi label="แปลงในรอบ" value={`${rows.length} แปลง`} />
        <Kpi label="ผลผลิตที่คาดทั้งรอบ" value={formatKg(expected)} />
      </div>
      <div className="mb-4 flex justify-end">
        <select aria-label="กลุ่ม" value={groupId} onChange={(event) => setGroupId(event.target.value)} className={`${inputClass} w-64`}>
          <option value="all">ทุกกลุ่ม</option>
          <option value="none">ไม่มีกลุ่ม</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      {page.rows.length === 0 && (
        <div className="rounded-[8px] border border-frame px-6 py-8 text-[14px] text-ink/60">ไม่มีแปลงในรอบนี้</div>
      )}
      <div className="space-y-6">
        {page.rows.map((month) => (
          <MonthBlock key={month.key} month={month.key} plots={month.plots} />
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-[8px] border border-frame">
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

function groupByMonth(plots: SeasonRow[]) {
  const grouped = new Map<string, SeasonRow[]>();
  for (const plot of plots) {
    const key = plot.plantedOn.slice(0, 7);
    const list = grouped.get(key) ?? [];
    list.push(plot);
    grouped.set(key, list);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, items]) => ({ key, plots: items }));
}

function MonthBlock({ month, plots }: { month: string; plots: SeasonRow[] }) {
  const { farmers, groups } = useMill();
  const area = plots.reduce((sum, plot) => sum + plot.areaRai, 0);
  return (
    <section className="overflow-hidden rounded-[8px] border border-frame">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        <span>ปลูกรอบ {formatThaiMonth(`${month}-01`)}</span>
        <span className="text-[14px]">
          {plots.length} แปลง · {area} ไร่
        </span>
      </div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["วันปลูก", "แปลง", "คู่ค้า", "กลุ่ม", "พันธุ์", "พื้นที่", "คาดเก็บ", ""].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plots.map((plot, index) => {
            const farmer = farmers.find((item) => item.id === plot.farmerId);
            return (
              <tr key={plot.plantingId} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{formatThaiDate(plot.plantedOn)}</td>
                <td className="px-5 py-3">{plot.name}</td>
                <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
                <td className="px-5 py-3">{groups.find((group) => group.id === farmer?.groupId)?.name ?? "—"}</td>
                <td className="px-5 py-3">{farmer?.variety ?? "—"}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                <td className="px-5 py-3">{formatThaiDate(plot.harvestOn)}</td>
                <td className="px-5 py-3">
                  {farmer && (
                    <Link href={`/map?farmer=${farmer.id}`} className="font-bold text-link underline">
                      แผนที่
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
