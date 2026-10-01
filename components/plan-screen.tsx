"use client";

import { useMemo, useState } from "react";
import { MemberPlan, PlotWorkspace } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { Kpi, PageHeader, Pagination, PrimaryButton, SearchSelect, SecondaryButton, inputClass, usePagination } from "@/components/ui";
import { VARIETIES, daysUntil, farmerName, formatKg, formatThaiDate, type Farmer, type Plot } from "@/lib/mill";

type SeasonRow = Plot & { plantingId: string; plantedOn: string; harvestOn: string; estKg: number };
type HarvestQuery = { from: string; to: string; groupId: string; variety: string };

const SOON_DAYS = 14;

export function PlanScreen() {
  const { plots, plantings, farmers, groups } = useMill();
  const openDates = useMemo(
    () =>
      plantings
        .filter((planting) => !planting.delivered && plots.some((plot) => plot.id === planting.plotId))
        .map((planting) => planting.harvestOn),
    [plantings, plots],
  );
  const today = isoToday();
  const [draft, setDraft] = useState<HarvestQuery>(() => ({ ...openingRange(openDates, today), groupId: "all", variety: "all" }));
  const [applied, setApplied] = useState(draft);
  const [plotId, setPlotId] = useState<string | null>(null);

  const pool = useMemo(() => {
    return plantings
      .filter((planting) => !planting.delivered)
      .flatMap((planting) => {
        const plot = plots.find((item) => item.id === planting.plotId);
        if (!plot) return [];
        const farmer = farmers.find((item) => item.id === plot.farmerId);
        if (applied.groupId === "none" && farmer?.groupId != null) return [];
        if (applied.groupId !== "all" && applied.groupId !== "none" && farmer?.groupId !== applied.groupId) return [];
        if (applied.variety !== "all" && plot.variety !== applied.variety) return [];
        return [{ ...plot, plantingId: planting.id, plantedOn: planting.plantedOn, harvestOn: planting.harvestOn, estKg: planting.estKg }];
      });
  }, [plantings, plots, farmers, applied]);

  const rows = useMemo(
    () => pool.filter((row) => inRange(row.harvestOn, applied.from, applied.to)).sort(byHarvest),
    [pool, applied.from, applied.to],
  );
  const page = usePagination(rows, `${applied.from}:${applied.to}:${applied.groupId}:${applied.variety}`);
  const selected = rows.some((row) => row.id === plotId) ? (plots.find((plot) => plot.id === plotId) ?? null) : null;
  const expected = rows.reduce((sum, plot) => sum + plot.estKg, 0);
  const earliest = rows[0] ?? null;
  const due = rows.filter((row) => daysUntil(row.harvestOn) <= 0).length;
  const soonestWait = earliest ? daysUntil(earliest.harvestOn) : null;

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="แผนรวม" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">กรองกำหนดเก็บ</div>
        <form
          className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(draft);
            setPlotId(null);
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            จากวัน
            <input
              type="date"
              aria-label="จากวัน"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ถึงวัน
            <input
              type="date"
              aria-label="ถึงวัน"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            กลุ่ม
            <SearchSelect
              label="กลุ่ม"
              className="mt-1"
              value={draft.groupId}
              onChange={(groupId) => setDraft({ ...draft, groupId })}
              options={[
                { value: "all", label: "ทุกกลุ่ม" },
                { value: "none", label: "ไม่มีกลุ่ม" },
                ...[...groups]
                  .sort((a, b) => a.name.localeCompare(b.name, "th"))
                  .map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พันธุ์
            <select
              aria-label="พันธุ์"
              value={draft.variety}
              onChange={(event) => setDraft({ ...draft, variety: event.target.value })}
              className={`${inputClass} mt-1`}
            >
              <option value="all">ทุกพันธุ์</option>
              {VARIETIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
            <SecondaryButton
              type="button"
              onClick={() => setDraft({ ...draft, from: `${today.slice(0, 7)}-01`, to: monthEnd(today) })}
            >
              เดือนนี้
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => setDraft({ ...draft, from: "", to: "" })}>
              ยังไม่เข้าทั้งหมด
            </SecondaryButton>
            <PrimaryButton type="submit">ค้นหา</PrimaryButton>
          </div>
        </form>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="แปลงในช่วงนี้" value={`${rows.length} แปลง`} />
        <Kpi label="ปริมาณที่คาด" value={formatKg(expected)} />
        <Kpi label="วันเก็บเร็วสุด" value={earliest ? formatThaiDate(earliest.harvestOn) : "—"} />
        <Kpi label="ถึงวันเร็วสุด" value={soonestWait == null ? "—" : soonestWait <= 0 ? "ถึงกำหนดแล้ว" : `อีก ${soonestWait} วัน`} />
      </div>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
          <div className="text-[16px] font-bold">แผนที่จะเข้า</div>
          <div className="text-[14px] font-bold">ถึงกำหนดแล้ว {due} แปลง</div>
        </div>
        <PlotRoundTable rows={page.rows} selectedId={selected?.id ?? null} onSelect={setPlotId} />
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          pageSize={page.pageSize}
          total={page.total}
          onPageChange={page.setPage}
          onPageSizeChange={page.setPageSize}
        />
        {selected && <PlotWorkspace plot={selected} onBack={() => setPlotId(null)} />}
      </div>
    </div>
  );
}

export function MemberSeasonScreen() {
  const { plantings, plots, farmers, groups } = useMill();
  const [groupId, setGroupId] = useState("all");
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const rows = useMemo(() => {
    return plantings
      .filter((planting) => !planting.delivered)
      .flatMap((planting) => {
        const plot = plots.find((item) => item.id === planting.plotId);
        return plot ? [{ ...plot, plantingId: planting.id, plantedOn: planting.plantedOn, harvestOn: planting.harvestOn, estKg: planting.estKg }] : [];
      });
  }, [plantings, plots]);
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
  const page = usePagination(people, groupId);
  const selected = farmers.find((farmer) => farmer.id === farmerId) ?? null;

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="รายสมาชิก" />
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
          <div className="text-[16px] font-bold">สมาชิก</div>
          <SearchSelect
            label="กลุ่ม"
            className="w-64"
            value={groupId}
            onChange={(next) => {
              setGroupId(next);
              setFarmerId(null);
            }}
            options={[
              { value: "all", label: "ทุกกลุ่ม" },
              { value: "none", label: "ไม่มีกลุ่ม" },
              ...[...groups]
                .sort((a, b) => a.name.localeCompare(b.name, "th"))
                .map((group) => ({ value: group.id, label: group.name })),
            ]}
          />
        </div>
        <MemberRoundTable farmers={page.rows} rows={rows} selectedId={farmerId} onSelect={setFarmerId} />
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          pageSize={page.pageSize}
          total={page.total}
          onPageChange={page.setPage}
          onPageSizeChange={page.setPageSize}
        />
        {selected && <MemberPlan farmer={selected} />}
      </div>
    </div>
  );
}

function harvestMark(harvestOn: string) {
  const left = daysUntil(harvestOn);
  if (left < 0) return { label: `เลย ${Math.abs(left)} วัน`, className: "text-danger" };
  if (left === 0) return { label: "ถึงกำหนด", className: "text-danger" };
  if (left <= 7) return { label: `อีก ${left} วัน`, className: "text-brand" };
  return { label: `อีก ${left} วัน`, className: "" };
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

function monthEnd(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

function openingRange(dates: string[], today: string) {
  const horizon = shiftIso(today, SOON_DAYS);
  if (dates.some((date) => date <= horizon)) {
    const earliest = [...dates].sort()[0] ?? today;
    return { from: earliest < today ? earliest : today, to: horizon };
  }
  const next = dates.filter((date) => date > horizon).sort()[0];
  return next ? { from: next, to: next } : { from: today, to: horizon };
}

function inRange(iso: string, from: string, to: string) {
  if (from && to && from > to) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function byHarvest(a: SeasonRow, b: SeasonRow) {
  return a.harvestOn.localeCompare(b.harvestOn) || a.name.localeCompare(b.name, "th");
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
          {["กำหนดเก็บ", "สถานะ", "แปลง", "สมาชิก", "กลุ่ม", "พันธุ์", "ที่คาด"].map((label) => (
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
              ไม่มีแผนเก็บในช่วงนี้
            </td>
          </tr>
        )}
        {rows.map((plot, index) => {
          const farmer = farmers.find((item) => item.id === plot.farmerId);
          const mark = harvestMark(plot.harvestOn);
          const picked = plot.id === selectedId;
          return (
            <tr
              key={plot.plantingId}
              onClick={() => onSelect(plot.id)}
              className={`cursor-pointer ${picked ? "bg-pick" : index % 2 === 1 ? "bg-table hover:bg-sub" : "bg-white hover:bg-sub"}`}
            >
              <td className="px-5 py-3 font-bold">{formatThaiDate(plot.harvestOn)}</td>
              <td className={`px-5 py-3 font-bold ${mark.className}`}>{mark.label}</td>
              <td className="px-5 py-3 font-bold">{plot.name}</td>
              <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
              <td className="px-5 py-3">{groups.find((group) => group.id === farmer?.groupId)?.name ?? "—"}</td>
              <td className="px-5 py-3">{plot.variety}</td>
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
