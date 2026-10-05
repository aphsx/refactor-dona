"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberPlan } from "@/components/groups-screen";
import { api } from "@/lib/api";
import { useServerPage } from "@/components/server-page";
import { PlantingActivityPanel } from "@/components/activities-screen";
import { PlanEditor } from "@/components/plan-editor";
import { useMill } from "@/components/store";
import { Calendar, RotateCcw, Search } from "lucide-react";
import {
  DateField,
  Glyph,
  Kpi,
  PageHeader,
  Pagination,
  PrimaryButton,
  SearchSelect,
  SecondaryButton,
  Select,
  SortableTh,
  TableScroll,
  inputClass,
  isWildcard,
  matchesQuery,
  openRow,
  orderBy,
  rowTone,
  tableClass,
  usePagination,
  useTableSort,
  type SortState,
} from "@/components/ui";
import {
  currentActivityStage,
  daysUntil,
  farmerName,
  formatKg,
  formatRai,
  formatThaiDate,
  openPlanting,
  plantingAreaSummary,
  varietyName,
  type Farmer,
  type Planting,
  type Plot,
  type PlotActivity,
  type Variety,
} from "@/lib/mill";

type SeasonRow = Plot & {
  varietyId: Variety;
  plantingId: string;
  plantedOn: string;
  harvestOn: string;
  estKg: number;
  plantedAreaRai: number;
  unplantedAreaRai: number;
  stage: string;
};
type HarvestQuery = { from: string; to: string; groupId: string; variety: string };
type MemberQuery = {
  name: string;
  tel: string;
  groupId: string;
  variety: string;
  harvestFrom: string;
  harvestTo: string;
};

const emptyMemberQuery: MemberQuery = {
  name: "",
  tel: "",
  groupId: "all",
  variety: "all",
  harvestFrom: "",
  harvestTo: "",
};

const SOON_DAYS = 14;

export function PlanScreen() {
  const { groups, varieties, revision } = useMill();
  const today = isoToday();
  const [draft, setDraft] = useState<HarvestQuery>({ from: today, to: shiftIso(today, SOON_DAYS), groupId: "all", variety: "all" });
  const [applied, setApplied] = useState(draft);
  const [plotId, setPlotId] = useState<string | null>(null);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  useEffect(() => {
    let alive = true;
    void api
      .listPlantings({
        harvestFrom: applied.from || undefined,
        harvestTo: applied.to || undefined,
        groupId: applied.groupId,
      })
      .then((items) => {
        if (alive) setPlantings(items);
      });
    return () => {
      alive = false;
    };
  }, [applied.from, applied.to, applied.groupId, revision]);
  const plots = useMemo(() => plotsFromPlantings(plantings), [plantings]);
  const farmers = useMemo(() => farmersFromPlantings(plantings), [plantings]);
  const activities: PlotActivity[] = [];

  const pool = useMemo(() => {
    return plantings
      .flatMap((planting) => {
        const plot = plots.find((item) => item.id === planting.plotId);
        if (!plot) return [];
        const farmer = farmers.find((item) => item.id === plot.farmerId);
        if (applied.groupId === "none" && farmer?.groupId != null) return [];
        if (applied.groupId !== "all" && applied.groupId !== "none" && farmer?.groupId !== applied.groupId) return [];
        if (applied.variety !== "all" && planting.varietyId !== Number(applied.variety)) return [];
        return [toSeasonRow(plot, planting, activities)];
      });
  }, [plantings, plots, farmers, activities, applied]);

  const rows = useMemo(
    () => pool.filter((row) => inRange(row.harvestOn, applied.from, applied.to)).sort(byHarvest),
    [pool, applied.from, applied.to],
  );
  const listingSort = useTableSort(`${applied.from}:${applied.to}:${applied.groupId}:${applied.variety}`);
  const ordered = orderBy(rows, listingSort.sort, (row, key) => planSortValue(row, key, farmers, groups));
  const page = usePagination(ordered, `${applied.from}:${applied.to}:${applied.groupId}:${applied.variety}`);
  const selected = rows.find((row) => row.id === plotId) ?? null;
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
            <DateField
              label="จากวัน"
              className="mt-1"
              value={draft.from}
              max={draft.to}
              onChange={(from) => setDraft({ ...draft, from, to: draft.to && from && draft.to < from ? from : draft.to })}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ถึงวัน
            <DateField label="ถึงวัน" className="mt-1" value={draft.to} min={draft.from} onChange={(to) => setDraft({ ...draft, to })} />
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
            <Select
              label="พันธุ์"
              className="mt-1"
              value={draft.variety}
              onChange={(variety) => setDraft({ ...draft, variety })}
              options={[{ value: "all", label: "ทุกพันธุ์" }, ...varieties.map((item) => ({ value: String(item.id), label: item.name }))]}
            />
          </label>
          <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
            <SecondaryButton
              type="button"
              onClick={() => setDraft({ ...draft, from: `${today.slice(0, 7)}-01`, to: monthEnd(today) })}
            >
              <Glyph icon={Calendar} />
              เดือนนี้
            </SecondaryButton>
            <SecondaryButton type="button" onClick={() => setDraft({ ...draft, from: "", to: "" })}>
              <Glyph icon={RotateCcw} />
              ยังไม่เข้าทั้งหมด
            </SecondaryButton>
            <PrimaryButton type="submit">
              <Glyph icon={Search} />
              ค้นหา
            </PrimaryButton>
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
        <PlotRoundTable rows={page.rows} selectedId={selected?.id ?? null} onSelect={setPlotId} sort={listingSort.sort} onSort={listingSort.toggleSort} />
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          pageSize={page.pageSize}
          total={page.total}
          onPageChange={page.setPage}
          onPageSizeChange={page.setPageSize}
        />
        {selected && <PlanDetail row={selected} onClose={() => setPlotId(null)} />}
      </div>
    </div>
  );
}

/** ค้นหาเกษตรกรเพื่อเปิดแผนรอบปลูก — ไม่จัดการแปลง/บัญชี */
export function MemberSeasonScreen() {
  const { groups, varieties, revision } = useMill();
  const [draft, setDraft] = useState<MemberQuery>(emptyMemberQuery);
  const [applied, setApplied] = useState<MemberQuery>(emptyMemberQuery);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Farmer | null>(null);

  const groupOptions = [
    { value: "all", label: "ทุกกลุ่ม" },
    { value: "none", label: "ไม่มีกลุ่ม" },
    ...[...groups].sort((a, b) => a.name.localeCompare(b.name, "th")).map((group) => ({ value: group.id, label: group.name })),
  ];

  const planFilter = applied.variety !== "all" || applied.harvestFrom !== "" || applied.harvestTo !== "";
  const server = useServerPage(`${searched}:${planFilter}:${applied.name}:${applied.tel}:${applied.groupId}:${revision}`, (pageNo, pageSize) => {
    if (!searched || planFilter) return Promise.resolve({ items: [] as Farmer[], total: 0 });
    const q = [applied.name, applied.tel].filter((part) => part.trim()).join(" ");
    return api.listFarmersPage({
      q,
      groupId: applied.groupId === "all" ? undefined : applied.groupId,
      page: pageNo,
      pageSize,
    });
  });
  const [scoped, setScoped] = useState<Farmer[]>([]);
  useEffect(() => {
    if (!searched || !planFilter) {
      setScoped([]);
      return;
    }
    let alive = true;
    void api
      .listPlantings({
        harvestFrom: applied.harvestFrom || undefined,
        harvestTo: applied.harvestTo || undefined,
        groupId: applied.groupId,
      })
      .then((items) => {
        if (!alive) return;
        const matched = items.filter((item) => applied.variety === "all" || item.varietyId === Number(applied.variety));
        setScoped(
          farmersFromPlantings(matched).filter((farmer) => {
            if (!isWildcard(applied.name) && !matchesQuery(applied.name, farmerName(farmer))) return false;
            if (!isWildcard(applied.tel) && !farmer.tel.replace(/\D/g, "").includes(applied.tel.replace(/\D/g, ""))) return false;
            return true;
          }),
        );
      });
    return () => {
      alive = false;
    };
  }, [searched, planFilter, applied, revision]);

  const listingSort = useTableSort(searched ? JSON.stringify(applied) : "idle");
  const orderedScoped = orderBy(scoped, listingSort.sort, (farmer, key) => memberSortValue(farmer, key, groups));
  const client = usePagination(planFilter ? orderedScoped : [], searched ? JSON.stringify(applied) : "idle");
  const orderedServer = orderBy(server.rows, listingSort.sort, (farmer, key) => memberSortValue(farmer, key, groups));
  const rows = planFilter ? client.rows : orderedServer;
  const pager = planFilter ? client : server;

  if (selected) {
    return (
      <div className="h-full overflow-y-auto px-7 py-6">
        <PageHeader current="แผนรายเกษตรกร" />
        <div className="overflow-hidden rounded-[8px] border border-frame">
          <MemberPlan key={selected.id} farmer={selected} onClose={() => setSelected(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="แผนรายเกษตรกร" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาเกษตรกร</div>
        <form
          className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(draft);
            setSearched(true);
            setSelected(null);
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อ
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            เบอร์โทร
            <input
              value={draft.tel}
              inputMode="tel"
              onChange={(event) => setDraft({ ...draft, tel: event.target.value })}
              placeholder="081"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            กลุ่ม
            <SearchSelect label="กลุ่ม" className="mt-1" value={draft.groupId} onChange={(groupId) => setDraft({ ...draft, groupId })} options={groupOptions} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พันธุ์
            <Select
              label="พันธุ์"
              className="mt-1"
              value={draft.variety}
              onChange={(variety) => setDraft({ ...draft, variety })}
              options={[{ value: "all", label: "ทุกพันธุ์" }, ...varieties.map((item) => ({ value: String(item.id), label: item.name }))]}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            จากวันเก็บ
            <DateField
              label="จากวันเก็บ"
              className="mt-1"
              value={draft.harvestFrom}
              max={draft.harvestTo}
              onChange={(harvestFrom) =>
                setDraft({ ...draft, harvestFrom, harvestTo: draft.harvestTo && harvestFrom && draft.harvestTo < harvestFrom ? harvestFrom : draft.harvestTo })
              }
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ถึงวันเก็บ
            <DateField
              label="ถึงวันเก็บ"
              className="mt-1"
              value={draft.harvestTo}
              min={draft.harvestFrom}
              onChange={(harvestTo) => setDraft({ ...draft, harvestTo })}
            />
          </label>
          <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
            <PrimaryButton type="submit">
              <Glyph icon={Search} />
              ค้นหา
            </PrimaryButton>
            <PrimaryButton
              type="button"
              onClick={() => {
                setDraft(emptyMemberQuery);
                setApplied(emptyMemberQuery);
                setSearched(false);
                setSelected(null);
              }}
            >
              <Glyph icon={RotateCcw} />
              ล้าง
            </PrimaryButton>
          </div>
        </form>
      </div>
      {searched && (
        <div className="overflow-hidden rounded-[8px] border border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">เลือกเกษตรกรเพื่อจัดการแผน</div>
          <TableScroll>
            <table className={tableClass}>
              <thead className="bg-table">
                <tr>
                  <SortableTh label="เกษตรกร" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="เบอร์โทร" column="tel" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="แผนเปิด" column="plans" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  <SortableTh label="แปลง" column="plots" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-ink/60">
                      ไม่พบเกษตรกร
                    </td>
                  </tr>
                )}
                {rows.map((farmer, index) => (
                    <tr
                      key={farmer.id}
                      onClick={(event) => openRow(event, () => setSelected(farmer))}
                      className={rowTone(index)}
                    >
                      <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                      <td className="px-5 py-3">{farmer.tel}</td>
                      <td className="px-5 py-3">{farmer.groupName || groups.find((group) => group.id === farmer.groupId)?.name || "—"}</td>
                      <td className="px-5 py-3 font-bold">{planFilter ? (farmer.plotCount ?? 0) : "—"}</td>
                      <td className="px-5 py-3">{farmer.plotCount ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableScroll>
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            pageSize={pager.pageSize}
            total={pager.total}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
        </div>
      )}
    </div>
  );
}

function memberSortValue(farmer: Farmer, key: string, groups: { id: string; name: string }[]) {
  if (key === "tel") return farmer.tel;
  if (key === "group") return farmer.groupName || groups.find((group) => group.id === farmer.groupId)?.name || "";
  if (key === "plans" || key === "plots") return farmer.plotCount ?? 0;
  return farmerName(farmer);
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

function toSeasonRow(plot: Plot, planting: Planting, activities: PlotActivity[]): SeasonRow {
  const summary = plantingAreaSummary(plot.areaRai, activities, planting.id);
  const planted = planting.stage ? (planting.plantedAreaRai ?? 0) : summary.plantedAreaRai;
  const unplanted = Math.max(0, Math.round((plot.areaRai - planted) * 100) / 100);
  return {
    ...plot,
    varietyId: planting.varietyId,
    plantingId: planting.id,
    plantedOn: planting.plantedOn,
    harvestOn: planting.harvestOn,
    estKg: planting.estKg,
    plantedAreaRai: planted,
    unplantedAreaRai: unplanted,
    stage: planting.stage || currentActivityStage(activities, planting.id),
  };
}

function plotsFromPlantings(items: Planting[]): Plot[] {
  const seen = new Map<string, Plot>();
  for (const item of items) {
    if (seen.has(item.plotId)) continue;
    seen.set(item.plotId, {
      id: item.plotId,
      farmerId: item.farmerId ?? "",
      name: item.plotName ?? "",
      areaRai: item.areaRai ?? 0,
      provinceId: 0,
      districtId: 0,
      subdistrictId: 0,
      ownerName: item.farmerName,
      groupName: item.groupName,
      polygon: [],
    });
  }
  return [...seen.values()];
}

function farmersFromPlantings(items: Planting[]): Farmer[] {
  const seen = new Map<string, Farmer>();
  for (const item of items) {
    if (!item.farmerId) continue;
    const existing = seen.get(item.farmerId);
    if (existing) {
      existing.plotCount = (existing.plotCount ?? 1) + 1;
      continue;
    }
    const [firstName, ...rest] = (item.farmerName ?? "").split(" ");
    seen.set(item.farmerId, {
      id: item.farmerId,
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      tel: item.farmerTel ?? "",
      address: "",
      provinceId: 0,
      districtId: 0,
      subdistrictId: 0,
      groupId: item.groupId ?? null,
      groupName: item.groupName,
      plotCount: 1,
      deliveredKg: 0,
    });
  }
  return [...seen.values()];
}

function byHarvest(a: SeasonRow, b: SeasonRow) {
  return a.harvestOn.localeCompare(b.harvestOn) || a.name.localeCompare(b.name, "th");
}

function planSortValue(row: SeasonRow, key: string, farmers: Farmer[], groups: { id: string; name: string }[]) {
  const farmer = farmers.find((item) => item.id === row.farmerId);
  if (key === "harvest") return row.harvestOn;
  if (key === "status") return daysUntil(row.harvestOn);
  if (key === "plot") return row.name;
  if (key === "farmer") return row.ownerName || (farmer ? farmerName(farmer) : "");
  if (key === "group") return row.groupName || groups.find((group) => group.id === farmer?.groupId)?.name || "";
  if (key === "variety") return varietyName(row.varietyId);
  if (key === "actual") return row.plantedAreaRai;
  if (key === "left") return row.unplantedAreaRai;
  if (key === "stage") return row.stage;
  return row.estKg;
}

function PlanDetail({ row, onClose }: { row: SeasonRow; onClose: () => void }) {
  return (
    <>
      <PlanEditor key={row.plantingId} plot={row} onClose={onClose} />
      <PlantingActivityPanel
        key={`activities:${row.plantingId}`}
        plotAreaRai={row.areaRai}
        plantingId={row.plantingId}
        varietyId={row.varietyId}
        plantedOn={row.plantedOn}
      />
    </>
  );
}

function PlotRoundTable({
  rows,
  selectedId,
  onSelect,
  sort,
  onSort,
  emptyLabel = "ไม่มีแผนเก็บในช่วงนี้",
}: {
  rows: SeasonRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: SortState;
  onSort: (key: string) => void;
  emptyLabel?: string;
}) {
  return (
    <TableScroll>
      <table className={tableClass}>
        <thead className="bg-table">
          <tr>
            <SortableTh label="กำหนดเก็บ" column="harvest" sort={sort} onSort={onSort} />
            <SortableTh label="สถานะ" column="status" sort={sort} onSort={onSort} />
            <SortableTh label="แปลง" column="plot" sort={sort} onSort={onSort} />
            <SortableTh label="เกษตรกร" column="farmer" sort={sort} onSort={onSort} />
            <SortableTh label="กลุ่ม" column="group" sort={sort} onSort={onSort} />
            <SortableTh label="พันธุ์" column="variety" sort={sort} onSort={onSort} />
            <SortableTh label="ปลูกจริง" column="actual" sort={sort} onSort={onSort} />
            <SortableTh label="ยังไม่ปลูก" column="left" sort={sort} onSort={onSort} />
            <SortableTh label="ขั้นตอนปัจจุบัน" column="stage" sort={sort} onSort={onSort} />
            <SortableTh label="ที่คาด" column="kg" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-5 py-6 text-ink/60">
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((plot, index) => {
            const mark = harvestMark(plot.harvestOn);
            const picked = plot.id === selectedId;
            return (
              <tr
                key={plot.plantingId}
                onClick={(event) => openRow(event, () => onSelect(plot.id))}
                className={rowTone(index, picked)}
              >
                <td className="px-5 py-3 font-bold">{formatThaiDate(plot.harvestOn)}</td>
                <td className={`px-5 py-3 font-bold ${mark.className}`}>{mark.label}</td>
                <td className="px-5 py-3 font-bold">{plot.name}</td>
                <td className="px-5 py-3">{plot.ownerName || "—"}</td>
                <td className="px-5 py-3">{plot.groupName || "—"}</td>
                <td className="px-5 py-3">{varietyName(plot.varietyId)}</td>
                <td className="px-5 py-3">{formatRai(plot.plantedAreaRai)}</td>
                <td className="px-5 py-3">{formatRai(plot.unplantedAreaRai)}</td>
                <td className="px-5 py-3 font-bold">{plot.stage}</td>
                <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}
