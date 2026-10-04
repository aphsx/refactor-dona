"use client";

import { useMemo, useState } from "react";
import { MemberPlan } from "@/components/groups-screen";
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
  VARIETIES,
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
  const { plots, plantings, farmers, groups, activities } = useMill();
  const openDates = useMemo(
    () =>
      plantings
        .filter((planting) => plots.some((plot) => plot.id === planting.plotId))
        .map((planting) => planting.harvestOn),
    [plantings, plots],
  );
  const today = isoToday();
  const [draft, setDraft] = useState<HarvestQuery>(() => ({ ...openingRange(openDates, today), groupId: "all", variety: "all" }));
  const [applied, setApplied] = useState(draft);
  const [plotId, setPlotId] = useState<string | null>(null);

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
              options={[{ value: "all", label: "ทุกพันธุ์" }, ...VARIETIES.map((item) => ({ value: String(item.id), label: item.name }))]}
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
  const { farmers, groups, plots, plantings } = useMill();
  const [draft, setDraft] = useState<MemberQuery>(emptyMemberQuery);
  const [applied, setApplied] = useState<MemberQuery>(emptyMemberQuery);
  const [searched, setSearched] = useState(false);
  const [farmerId, setFarmerId] = useState<string | null>(null);

  const groupOptions = [
    { value: "all", label: "ทุกกลุ่ม" },
    { value: "none", label: "ไม่มีกลุ่ม" },
    ...[...groups].sort((a, b) => a.name.localeCompare(b.name, "th")).map((group) => ({ value: group.id, label: group.name })),
  ];

  const planFilter = applied.variety !== "all" || applied.harvestFrom !== "" || applied.harvestTo !== "";

  const matchingPlanFarmerIds = useMemo(() => {
    if (!planFilter) return null;
    const ids = new Set<string>();
    for (const planting of plantings) {
      const plot = plots.find((item) => item.id === planting.plotId);
      if (!plot) continue;
      if (applied.variety !== "all" && planting.varietyId !== Number(applied.variety)) continue;
      if (!inRange(planting.harvestOn, applied.harvestFrom, applied.harvestTo)) continue;
      ids.add(plot.farmerId);
    }
    return ids;
  }, [plantings, plots, applied, planFilter]);

  const people = useMemo(() => {
    if (!searched) return [];
    return farmers
      .filter((farmer) => {
        if (applied.groupId === "none" && farmer.groupId != null) return false;
        if (applied.groupId !== "all" && applied.groupId !== "none" && farmer.groupId !== applied.groupId) return false;
        if (!isWildcard(applied.name) && !matchesQuery(applied.name, farmerName(farmer))) return false;
        if (!isWildcard(applied.tel) && !farmer.tel.replace(/\D/g, "").includes(applied.tel.replace(/\D/g, ""))) return false;
        if (matchingPlanFarmerIds && !matchingPlanFarmerIds.has(farmer.id)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"));
  }, [farmers, applied, searched, matchingPlanFarmerIds]);

  const listingSort = useTableSort(searched ? JSON.stringify(applied) : "idle");
  const ordered = orderBy(people, listingSort.sort, (farmer, key) => {
    if (key === "name") return farmerName(farmer);
    if (key === "tel") return farmer.tel;
    if (key === "group") return groups.find((group) => group.id === farmer.groupId)?.name ?? "";
    if (key === "plans") return openPlanCount(farmer.id, plots, plantings);
    return plots.filter((plot) => plot.farmerId === farmer.id).length;
  });
  const page = usePagination(ordered, searched ? JSON.stringify(applied) : "idle");
  const selected = farmers.find((farmer) => farmer.id === farmerId) ?? null;

  if (selected) {
    return (
      <div className="h-full overflow-y-auto px-7 py-6">
        <PageHeader current="แผนรายเกษตรกร" />
        <div className="overflow-hidden rounded-[8px] border border-frame">
          <MemberPlan key={selected.id} farmer={selected} onClose={() => setFarmerId(null)} />
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
            setFarmerId(null);
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
              options={[{ value: "all", label: "ทุกพันธุ์" }, ...VARIETIES.map((item) => ({ value: String(item.id), label: item.name }))]}
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
            <SecondaryButton
              type="button"
              onClick={() => {
                setDraft(emptyMemberQuery);
                setApplied(emptyMemberQuery);
                setSearched(false);
                setFarmerId(null);
              }}
            >
              <Glyph icon={RotateCcw} />
              ล้าง
            </SecondaryButton>
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
                {ordered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-ink/60">
                      ไม่พบเกษตรกร
                    </td>
                  </tr>
                )}
                {page.rows.map((farmer, index) => {
                  const planCount = openPlanCount(farmer.id, plots, plantings);
                  const plotCount = plots.filter((plot) => plot.farmerId === farmer.id).length;
                  return (
                    <tr
                      key={farmer.id}
                      onClick={(event) => openRow(event, () => setFarmerId(farmer.id))}
                      className={rowTone(index)}
                    >
                      <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                      <td className="px-5 py-3">{farmer.tel}</td>
                      <td className="px-5 py-3">{groups.find((group) => group.id === farmer.groupId)?.name ?? "—"}</td>
                      <td className="px-5 py-3 font-bold">{planCount}</td>
                      <td className="px-5 py-3">{plotCount}</td>
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
      )}
    </div>
  );
}

function openPlanCount(farmerId: string, plots: Plot[], plantings: Planting[]) {
  return plots.filter((plot) => plot.farmerId === farmerId && openPlanting(plantings, plot.id)).length;
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
  const area = plantingAreaSummary(plot.areaRai, activities, planting.id);
  return {
    ...plot,
    varietyId: planting.varietyId,
    plantingId: planting.id,
    plantedOn: planting.plantedOn,
    harvestOn: planting.harvestOn,
    estKg: planting.estKg,
    plantedAreaRai: area.plantedAreaRai,
    unplantedAreaRai: area.unplantedAreaRai,
    stage: currentActivityStage(activities, planting.id),
  };
}

function byHarvest(a: SeasonRow, b: SeasonRow) {
  return a.harvestOn.localeCompare(b.harvestOn) || a.name.localeCompare(b.name, "th");
}

function planSortValue(row: SeasonRow, key: string, farmers: Farmer[], groups: { id: string; name: string }[]) {
  const farmer = farmers.find((item) => item.id === row.farmerId);
  if (key === "harvest") return row.harvestOn;
  if (key === "status") return daysUntil(row.harvestOn);
  if (key === "plot") return row.name;
  if (key === "farmer") return farmer ? farmerName(farmer) : "";
  if (key === "group") return groups.find((group) => group.id === farmer?.groupId)?.name ?? "";
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
  const { farmers, groups } = useMill();
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
            const farmer = farmers.find((item) => item.id === plot.farmerId);
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
                <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
                <td className="px-5 py-3">{groups.find((group) => group.id === farmer?.groupId)?.name ?? "—"}</td>
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
