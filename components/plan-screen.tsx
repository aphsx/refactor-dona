"use client";

import { useMemo, useState } from "react";
import { MemberPlan, PlotWorkspace } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { Kpi, PageHeader, Pagination, StatusTab, inputClass, usePagination } from "@/components/ui";
import { daysUntil, farmerName, formatKg, formatThaiDate, type Farmer, type Plot } from "@/lib/mill";

type SeasonRow = Plot & { plantingId: string; plantedOn: string; harvestOn: string; estKg: number };

export function PlanScreen() {
  const { plots, plantings, farmers, groups } = useMill();
  const [tab, setTab] = useState<"plots" | "members">("plots");
  const [groupId, setGroupId] = useState("all");
  const [plotId, setPlotId] = useState<string | null>(null);
  const [farmerId, setFarmerId] = useState<string | null>(null);

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
      .sort((a, b) => a.plantedOn.localeCompare(b.plantedOn) || a.name.localeCompare(b.name, "th"));
  }, [plantings, plots, farmers, groupId]);

  const people = useMemo(() => {
    return farmers
      .filter((farmer) => {
        if (groupId === "none") return farmer.groupId == null;
        if (groupId !== "all") return farmer.groupId === groupId;
        return true;
      })
      .slice()
      .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"));
  }, [farmers, groupId]);

  const plotPage = usePagination(rows, groupId);
  const memberPage = usePagination(people, groupId);
  const selected = plots.find((plot) => plot.id === plotId) ?? null;
  const selectedFarmer = farmers.find((farmer) => farmer.id === farmerId) ?? null;
  const area = rows.reduce((sum, plot) => sum + plot.areaRai, 0);
  const expected = rows.reduce((sum, plot) => sum + plot.estKg, 0);

  function changeGroup(next: string) {
    setGroupId(next);
    setPlotId(null);
    setFarmerId(null);
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="แผนรอบปลูก" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        <Kpi label="พื้นที่ปลูกรอบนี้" value={`${area} ไร่`} />
        <Kpi label="แปลงในรอบ" value={`${rows.length} แปลง`} />
        <Kpi label="ผลผลิตที่คาดทั้งรอบ" value={formatKg(expected)} />
      </div>
      <div className="flex items-end gap-1">
        <StatusTab
          label="แผนรวม"
          active={tab === "plots"}
          onClick={() => {
            setTab("plots");
            setFarmerId(null);
          }}
        />
        <StatusTab
          label="รายสมาชิก"
          active={tab === "members"}
          onClick={() => {
            setTab("members");
            setPlotId(null);
          }}
        />
      </div>
      <div className="overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
          <div className="text-[16px] font-bold">{tab === "plots" ? "แปลงในรอบ" : "สมาชิก"}</div>
          <select aria-label="กลุ่ม" value={groupId} onChange={(event) => changeGroup(event.target.value)} className={`${inputClass} w-64`}>
            <option value="all">ทุกกลุ่ม</option>
            <option value="none">ไม่มีกลุ่ม</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        {tab === "plots" ? (
          <PlotRoundTable rows={plotPage.rows} selectedId={plotId} onSelect={setPlotId} />
        ) : (
          <MemberRoundTable farmers={memberPage.rows} rows={rows} selectedId={farmerId} onSelect={setFarmerId} />
        )}
        <Pagination
          page={tab === "plots" ? plotPage.page : memberPage.page}
          pageCount={tab === "plots" ? plotPage.pageCount : memberPage.pageCount}
          pageSize={tab === "plots" ? plotPage.pageSize : memberPage.pageSize}
          total={tab === "plots" ? plotPage.total : memberPage.total}
          onPageChange={tab === "plots" ? plotPage.setPage : memberPage.setPage}
          onPageSizeChange={tab === "plots" ? plotPage.setPageSize : memberPage.setPageSize}
        />
        {tab === "plots" && selected && <PlotWorkspace plot={selected} onBack={() => setPlotId(null)} />}
        {tab === "members" && selectedFarmer && <MemberPlan farmer={selectedFarmer} />}
      </div>
    </div>
  );
}

function roundMark(plantedOn: string) {
  if (daysUntil(plantedOn) > 0) return { label: "วางแผน", className: "" };
  return { label: "ปลูกแล้ว", className: "text-brand" };
}

function PlotRoundTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: SeasonRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { farmers, groups } = useMill();
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <thead className="bg-table">
        <tr>
          {["แปลง", "สมาชิก", "กลุ่ม", "สถานะ", "วันปลูก", "กำหนดเก็บ", "ที่คาด"].map((label) => (
            <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-5 py-6 text-ink/60">
              ไม่มีแปลงในรอบนี้
            </td>
          </tr>
        )}
        {rows.map((plot, index) => {
          const farmer = farmers.find((item) => item.id === plot.farmerId);
          const mark = roundMark(plot.plantedOn);
          const picked = plot.id === selectedId;
          return (
            <tr
              key={plot.plantingId}
              onClick={() => onSelect(plot.id)}
              className={`cursor-pointer ${picked ? "bg-pick" : index % 2 === 1 ? "bg-table hover:bg-sub" : "bg-white hover:bg-sub"}`}
            >
              <td className="px-5 py-3 font-bold">{plot.name}</td>
              <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
              <td className="px-5 py-3">{groups.find((group) => group.id === farmer?.groupId)?.name ?? "—"}</td>
              <td className={`px-5 py-3 font-bold ${mark.className}`}>{mark.label}</td>
              <td className="px-5 py-3">{formatThaiDate(plot.plantedOn)}</td>
              <td className="px-5 py-3">{formatThaiDate(plot.harvestOn)}</td>
              <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MemberRoundTable({
  farmers,
  rows,
  selectedId,
  onSelect,
}: {
  farmers: Farmer[];
  rows: SeasonRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { groups } = useMill();
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <thead className="bg-table">
        <tr>
          {["สมาชิก", "กลุ่ม", "แปลงในรอบ", "พื้นที่", "ที่คาด"].map((label) => (
            <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {farmers.length === 0 && (
          <tr>
            <td colSpan={5} className="px-5 py-6 text-ink/60">
              ไม่มีสมาชิก
            </td>
          </tr>
        )}
        {farmers.map((farmer, index) => {
          const mine = rows.filter((plot) => plot.farmerId === farmer.id);
          const area = mine.reduce((sum, plot) => sum + plot.areaRai, 0);
          const expected = mine.reduce((sum, plot) => sum + plot.estKg, 0);
          const picked = farmer.id === selectedId;
          return (
            <tr
              key={farmer.id}
              onClick={() => onSelect(farmer.id)}
              className={`cursor-pointer ${picked ? "bg-pick" : index % 2 === 1 ? "bg-table hover:bg-sub" : "bg-white hover:bg-sub"}`}
            >
              <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
              <td className="px-5 py-3">{groups.find((group) => group.id === farmer.groupId)?.name ?? "—"}</td>
              <td className="px-5 py-3">{mine.length}</td>
              <td className="px-5 py-3">{mine.length === 0 ? "—" : `${area} ไร่`}</td>
              <td className="px-5 py-3">{mine.length === 0 ? "—" : formatKg(expected)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
