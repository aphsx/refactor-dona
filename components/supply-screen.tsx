"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMill } from "@/components/store";
import { api } from "@/lib/api";
import { Kpi, PageHeader, Pagination, SearchSelect, SortableTh, StatusTab, TableScroll, orderBy, tableClass, usePagination, useTableSort } from "@/components/ui";
import { daysUntil, formatKg, formatThaiDate, varietyName, type Planting, type Plot, type Variety } from "@/lib/mill";

type SupplyRow = Plot & { varietyId: Variety; plantingId: string; harvestOn: string; estKg: number };

type WindowFilter = "ใกล้เก็บเกี่ยว" | "เดือนนี้" | "ยังไม่เข้า";

export function SupplyScreen() {
  const { groups, revision } = useMill();
  const [filter, setFilter] = useState<WindowFilter>("ใกล้เก็บเกี่ยว");
  const [groupId, setGroupId] = useState("all");
  const [plantings, setPlantings] = useState<Planting[]>([]);

  useEffect(() => {
    const today = isoToday();
    const harvestTo = filter === "ใกล้เก็บเกี่ยว" ? shiftIso(today, 7) : filter === "เดือนนี้" ? shiftIso(today, 31) : undefined;
    let alive = true;
    void api.listPlantings({ harvestTo, groupId }).then((items) => {
      if (alive) setPlantings(items);
    });
    return () => {
      alive = false;
    };
  }, [filter, groupId, revision]);

  const owned = useMemo(() => {
    return plantings.map((planting) => ({
      id: planting.plotId,
      farmerId: planting.farmerId ?? "",
      name: planting.plotName ?? "",
      areaRai: planting.areaRai ?? 0,
      provinceId: 0,
      districtId: 0,
      subdistrictId: 0,
      ownerName: planting.farmerName,
      groupName: planting.groupName,
      polygon: [] as [number, number][],
      varietyId: planting.varietyId,
      plantingId: planting.id,
      harvestOn: planting.harvestOn,
      estKg: planting.estKg,
    }));
  }, [plantings]);

  const due = owned.filter((plot) => daysUntil(plot.harvestOn) <= 0);
  const soon = owned.filter((plot) => daysUntil(plot.harvestOn) <= 7);
  const soonKg = soon.reduce((sum, plot) => sum + plot.estKg, 0);

  const days = owned.filter((plot) => {
    const left = daysUntil(plot.harvestOn);
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
        <Kpi label="คาดทั้งหมด" value={formatKg(owned.reduce((sum, plot) => sum + plot.estKg, 0))} />
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-1">
          {(["ใกล้เก็บเกี่ยว", "เดือนนี้", "ยังไม่เข้า"] as WindowFilter[]).map((item) => (
            <StatusTab key={item} label={item} active={filter === item} onClick={() => setFilter(item)} />
          ))}
        </div>
        <SearchSelect
          label="กลุ่ม"
          className="w-64"
          value={groupId}
          onChange={setGroupId}
          options={[
            { value: "all", label: "ทุกกลุ่ม" },
            { value: "none", label: "ไม่มีกลุ่ม" },
            ...[...groups]
              .sort((a, b) => a.name.localeCompare(b.name, "th"))
              .map((group) => ({ value: group.id, label: group.name })),
          ]}
        />
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

function isoToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftIso(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
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
  if (plots.some((plot) => daysUntil(plot.harvestOn) <= 0)) return "ถึงกำหนด";
  if (plots.some((plot) => daysUntil(plot.harvestOn) <= 7)) return "ใกล้เก็บเกี่ยว";
  return "";
}

function DateQueue({ date, plots }: { date: string; plots: SupplyRow[] }) {
  const listingSort = useTableSort(date);
  const ordered = orderBy(plots, listingSort.sort, (plot, key) => {
    const left = daysUntil(plot.harvestOn);
    if (key === "name") return plot.name;
    if (key === "farmer") return plot.ownerName ?? "";
    if (key === "group") return plot.groupName ?? "";
    if (key === "variety") return varietyName(plot.varietyId);
    if (key === "area") return plot.areaRai;
    if (key === "kg") return plot.estKg;
    return left <= 0 ? "ถึงกำหนด" : left <= 7 ? "ใกล้เก็บเกี่ยว" : `อีก ${left} วัน`;
  });
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
      <TableScroll>
<table className={tableClass}>
        <thead className="bg-table">
          <tr>
            <SortableTh label="แปลง" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="เกษตรกร" column="farmer" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="พันธุ์" column="variety" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="พื้นที่" column="area" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="ที่คาด" column="kg" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="สถานะ" column="status" sort={listingSort.sort} onSort={listingSort.toggleSort} />
            <SortableTh label="" sort={listingSort.sort} onSort={listingSort.toggleSort} />
          </tr>
        </thead>
        <tbody>
          {ordered.map((plot, index) => {
            const left = daysUntil(plot.harvestOn);
            const status = left <= 0 ? "ถึงกำหนด" : left <= 7 ? "ใกล้เก็บเกี่ยว" : `อีก ${left} วัน`;
            return (
              <tr key={plot.plantingId} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{plot.ownerName || "—"}</td>
                <td className="px-5 py-3">{plot.groupName || "—"}</td>
                <td className="px-5 py-3">{varietyName(plot.varietyId)}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
                <td className={`px-5 py-3 font-bold ${left <= 7 ? "text-brand" : ""}`}>{status}</td>
                <td className="px-5 py-3">
                  {plot.farmerId && (
                    <Link href={`/map?farmer=${plot.farmerId}`} className="font-bold text-link underline">
                      แผนที่
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
</TableScroll>
    </section>
  );
}
