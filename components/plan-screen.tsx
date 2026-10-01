"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMill } from "@/components/store";
import { Kpi, PageHeader, Pagination, StatusTab, inputClass, usePagination } from "@/components/ui";
import { daysUntil, farmerName, formatKg, formatThaiDate, type Plot } from "@/lib/mill";

type PlanTab = "แผนปลูก" | "แผนเก็บเกี่ยว";

export function PlanScreen() {
  const { plots, farmers, groups } = useMill();
  const [tab, setTab] = useState<PlanTab>("แผนเก็บเกี่ยว");
  const [groupId, setGroupId] = useState("all");

  const rows = useMemo(() => {
    return plots
      .filter((plot) => {
        const farmer = farmers.find((item) => item.id === plot.farmerId);
        if (groupId === "all") return true;
        if (groupId === "none") return farmer?.groupId == null;
        return farmer?.groupId === groupId;
      })
      .slice()
      .sort((a, b) => (tab === "แผนปลูก" ? a.plantedOn.localeCompare(b.plantedOn) : a.harvestOn.localeCompare(b.harvestOn)));
  }, [plots, farmers, groupId, tab]);

  const page = usePagination(rows, `${tab}:${groupId}`);
  const pending = rows.filter((plot) => !plot.delivered);
  const withinSeven = pending.filter((plot) => daysUntil(plot.harvestOn) <= 7);
  const expectedKg = pending.reduce((sum, plot) => sum + plot.estKg, 0);
  const area = rows.reduce((sum, plot) => sum + plot.areaRai, 0);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="แผนรอบปลูก" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="พื้นที่ในแผน" value={`${area} ไร่`} />
        <Kpi label="คาดว่าจะได้ทั้งรอบ" value={formatKg(expectedKg)} />
        <Kpi label="เข้าภายใน 7 วัน" value={formatKg(withinSeven.reduce((sum, plot) => sum + plot.estKg, 0))} />
        <Kpi label="แปลงในแผน" value={`${rows.length} แปลง`} />
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-1">
          {(["แผนเก็บเกี่ยว", "แผนปลูก"] as PlanTab[]).map((item) => (
            <StatusTab key={item} label={item} active={tab === item} onClick={() => setTab(item)} />
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
      {tab === "แผนเก็บเกี่ยว" ? <HarvestTable rows={page.rows} /> : <PlantTable rows={page.rows} />}
      <div className="overflow-hidden rounded-b-[8px] border border-t-0 border-frame">
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

function groupName(groups: { id: string; name: string }[], farmers: { id: string; groupId: string | null }[], plot: Plot) {
  const farmer = farmers.find((item) => item.id === plot.farmerId);
  return groups.find((group) => group.id === farmer?.groupId)?.name ?? "—";
}

function HarvestTable({ rows }: { rows: Plot[] }) {
  const { farmers, groups } = useMill();
  return (
    <div className="overflow-hidden rounded-t-[8px] border border-frame">
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">จะได้เข้ามาเมื่อไหร่</div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["วันเก็บ", "กลุ่ม", "แปลง", "คู่ค้า", "พันธุ์", "ที่คาด", "สถานะ", ""].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((plot, index) => {
            const farmer = farmers.find((item) => item.id === plot.farmerId);
            const days = daysUntil(plot.harvestOn);
            const status = plot.delivered ? "รับแล้ว" : days <= 0 ? "ถึงกำหนด" : `อีก ${days} วัน`;
            return (
              <tr key={plot.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{formatThaiDate(plot.harvestOn)}</td>
                <td className="px-5 py-3">{groupName(groups, farmers, plot)}</td>
                <td className="px-5 py-3">{plot.name}</td>
                <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
                <td className="px-5 py-3">{farmer?.variety ?? "—"}</td>
                <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
                <td className="px-5 py-3">{status}</td>
                <td className="px-5 py-3">
                  {farmer && (
                    <Link href={`/supply?farmer=${farmer.id}`} className="font-bold text-link underline">
                      ดูแปลง
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlantTable({ rows }: { rows: Plot[] }) {
  const { farmers, groups } = useMill();
  return (
    <div className="overflow-hidden rounded-t-[8px] border border-frame">
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ลงปลูกแล้วรอบนี้</div>
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-table">
          <tr>
            {["วันปลูก", "กลุ่ม", "แปลง", "คู่ค้า", "พันธุ์", "พื้นที่", "ที่คาด"].map((label) => (
              <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((plot, index) => {
            const farmer = farmers.find((item) => item.id === plot.farmerId);
            return (
              <tr key={plot.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{formatThaiDate(plot.plantedOn)}</td>
                <td className="px-5 py-3">{groupName(groups, farmers, plot)}</td>
                <td className="px-5 py-3">{plot.name}</td>
                <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
                <td className="px-5 py-3">{farmer?.variety ?? "—"}</td>
                <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
