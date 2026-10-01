"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMill } from "@/components/store";
import { Kpi, PageHeader, Pagination, StatusTab, inputClass, usePagination } from "@/components/ui";
import { daysUntil, farmerName, formatKg, formatThaiDate, type Plot } from "@/lib/mill";

type SupplyRow = Plot & { plantingId: string; harvestOn: string; estKg: number; delivered: boolean };

type WindowFilter = "ใกล้เก็บเกี่ยว" | "เดือนนี้" | "ยังไม่เข้า" | "รับแล้ว";

export function SupplyScreen() {
  const { plots, plantings, farmers, groups } = useMill();
  const [filter, setFilter] = useState<WindowFilter>("ใกล้เก็บเกี่ยว");
  const [groupId, setGroupId] = useState("all");

  const owned = useMemo(() => {
    return plantings.flatMap((planting) => {
      const plot = plots.find((item) => item.id === planting.plotId);
      if (!plot) return [];
      const farmer = farmers.find((item) => item.id === plot.farmerId);
      if (groupId === "none" && farmer?.groupId != null) return [];
      if (groupId !== "all" && groupId !== "none" && farmer?.groupId !== groupId) return [];
      return [{ ...plot, plantingId: planting.id, harvestOn: planting.harvestOn, estKg: planting.estKg, delivered: planting.delivered }];
    });
  }, [plantings, plots, farmers, groupId]);

  const pending = owned.filter((plot) => !plot.delivered);
  const due = pending.filter((plot) => daysUntil(plot.harvestOn) <= 0);
  const soon = pending.filter((plot) => daysUntil(plot.harvestOn) <= 7);
  const soonKg = soon.reduce((sum, plot) => sum + plot.estKg, 0);

  const days = owned.filter((plot) => {
    const left = daysUntil(plot.harvestOn);
    if (filter === "รับแล้ว") return plot.delivered;
    if (plot.delivered) return false;
    if (filter === "ใกล้เก็บเกี่ยว") return left <= 7;
    if (filter === "เดือนนี้") return left <= 31;
    return true;
  });

  const queues = useMemo(() => groupByHarvest(days), [days]);
  const page = usePagination(queues, `${filter}:${groupId}`);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="แผนรับข้าว" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="ใกล้เก็บเกี่ยว" value={`${soon.length} แปลง`} />
        <Kpi label="ปริมาณที่ใกล้เข้า" value={formatKg(soonKg)} />
        <Kpi label="ถึงกำหนดแล้ว" value={`${due.length} แปลง`} />
        <Kpi label="ยังไม่เข้าทั้งหมด" value={formatKg(pending.reduce((sum, plot) => sum + plot.estKg, 0))} />
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-1">
          {(["ใกล้เก็บเกี่ยว", "เดือนนี้", "ยังไม่เข้า", "รับแล้ว"] as WindowFilter[]).map((item) => (
            <StatusTab key={item} label={item} active={filter === item} onClick={() => setFilter(item)} />
          ))}
        </div>
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
        <div className="rounded-[8px] border border-frame px-6 py-8 text-[14px] text-ink/60">ไม่มีแปลงในช่วงนี้</div>
      )}
      <div className="space-y-6">
        {page.rows.map((queue) => (
          <DateQueue key={queue.date} date={queue.date} plots={queue.plots} />
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

function groupByHarvest(plots: SupplyRow[]) {
  const grouped = new Map<string, SupplyRow[]>();
  for (const plot of plots) {
    const list = grouped.get(plot.harvestOn) ?? [];
    list.push(plot);
    grouped.set(plot.harvestOn, list);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, items]) => ({ date, plots: items }));
}

function queueMark(plots: SupplyRow[]) {
  const open = plots.filter((plot) => !plot.delivered);
  if (open.length === 0) return "รับแล้ว";
  if (open.some((plot) => daysUntil(plot.harvestOn) <= 0)) return "ถึงกำหนด";
  if (open.some((plot) => daysUntil(plot.harvestOn) <= 7)) return "ใกล้เก็บเกี่ยว";
  return "";
}

function DateQueue({ date, plots }: { date: string; plots: SupplyRow[] }) {
  const { farmers, groups } = useMill();
  const mark = queueMark(plots);
  const kg = plots.reduce((sum, plot) => sum + plot.estKg, 0);
  return (
    <section className="overflow-hidden rounded-[8px] border border-frame">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">{formatThaiDate(date)}</div>
        <div className="flex items-center gap-3 text-[14px] font-bold">
          <span>
            {plots.length} แปลง · {formatKg(kg)}
          </span>
          {mark && <span className="rounded-[6px] bg-white px-2 py-1 text-[12px] text-bar">{mark}</span>}
        </div>
      </div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["แปลง", "คู่ค้า", "กลุ่ม", "พันธุ์", "พื้นที่", "ที่คาด", "สถานะ", ""].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plots.map((plot, index) => {
            const farmer = farmers.find((item) => item.id === plot.farmerId);
            const left = daysUntil(plot.harvestOn);
            const status = plot.delivered ? "รับแล้ว" : left <= 0 ? "ถึงกำหนด" : left <= 7 ? "ใกล้เก็บเกี่ยว" : `อีก ${left} วัน`;
            return (
              <tr key={plot.plantingId} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
                <td className="px-5 py-3">{groups.find((group) => group.id === farmer?.groupId)?.name ?? "—"}</td>
                <td className="px-5 py-3">{farmer?.variety ?? "—"}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
                <td className={`px-5 py-3 font-bold ${plot.delivered ? "text-ok" : left <= 7 ? "text-brand" : ""}`}>{status}</td>
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
