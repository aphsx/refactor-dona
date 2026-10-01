"use client";

import { useEffect, useMemo, useState } from "react";
import { PlotDialog, PlotWorkspace } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { Calendar, Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { ConfirmAlert, DateField, Glyph, Kpi, PageHeader, Pagination, PrimaryButton, ResultAlert, SearchSelect, SecondaryButton, Select, inputClass, openRow, rowTone, usePagination } from "@/components/ui";
import { VARIETIES, daysUntil, farmerName, formatKg, formatThaiDate, type Farmer, type Plot, type Variety } from "@/lib/mill";

type SeasonRow = Plot & { plantingId: string; plantedOn: string; harvestOn: string; estKg: number };
type HarvestQuery = { from: string; to: string; groupId: string; variety: string };
type MemberQuery = {
  name: string;
  tel: string;
  groupId: string;
  variety: string;
  plantedFrom: string;
  plantedTo: string;
  harvestFrom: string;
  harvestTo: string;
};

const emptyMemberQuery: MemberQuery = {
  name: "",
  tel: "",
  groupId: "all",
  variety: "all",
  plantedFrom: "",
  plantedTo: "",
  harvestFrom: "",
  harvestTo: "",
};

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
              options={[{ value: "all", label: "ทุกพันธุ์" }, ...VARIETIES.map((item) => ({ value: item, label: item }))]}
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
  const { plantings, plots, farmers, groups, addPlot } = useMill();
  const [draft, setDraft] = useState<MemberQuery>(emptyMemberQuery);
  const [applied, setApplied] = useState<MemberQuery>(emptyMemberQuery);
  const [searched, setSearched] = useState(false);
  const [plotId, setPlotId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const groupOptions = [
    { value: "all", label: "ทุกกลุ่ม" },
    { value: "none", label: "ไม่มีกลุ่ม" },
    ...[...groups].sort((a, b) => a.name.localeCompare(b.name, "th")).map((group) => ({ value: group.id, label: group.name })),
  ];
  const rounds = useMemo(() => {
    return plantings
      .filter((planting) => !planting.delivered)
      .flatMap((planting) => {
        const plot = plots.find((item) => item.id === planting.plotId);
        if (!plot) return [];
        if (applied.variety !== "all" && plot.variety !== applied.variety) return [];
        if (!inRange(planting.plantedOn, applied.plantedFrom, applied.plantedTo)) return [];
        if (!inRange(planting.harvestOn, applied.harvestFrom, applied.harvestTo)) return [];
        return [{ ...plot, plantingId: planting.id, plantedOn: planting.plantedOn, harvestOn: planting.harvestOn, estKg: planting.estKg }];
      });
  }, [plantings, plots, applied]);
  const plotFilter =
    applied.variety !== "all" || applied.plantedFrom !== "" || applied.plantedTo !== "" || applied.harvestFrom !== "" || applied.harvestTo !== "";
  const people = useMemo(() => {
    const name = applied.name.trim().toLocaleLowerCase("th");
    const tel = applied.tel.replace(/\D/g, "");
    return farmers
      .filter((farmer) => {
        if (applied.groupId === "none" && farmer.groupId != null) return false;
        if (applied.groupId !== "all" && applied.groupId !== "none" && farmer.groupId !== applied.groupId) return false;
        if (name && !farmerName(farmer).toLocaleLowerCase("th").includes(name)) return false;
        if (tel && !farmer.tel.replace(/\D/g, "").includes(tel)) return false;
        if (plotFilter && !rounds.some((row) => row.farmerId === farmer.id)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"));
  }, [farmers, applied, plotFilter, rounds]);
  const adding = people.find((farmer) => farmer.id === addingId) ?? null;

  function search(next: MemberQuery) {
    setDraft(next);
    setApplied(next);
    setSearched(true);
    setPlotId(null);
    setAddingId(null);
  }

  function clear() {
    setDraft(emptyMemberQuery);
    setApplied(emptyMemberQuery);
    setSearched(false);
    setPlotId(null);
    setAddingId(null);
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="รายสมาชิก" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาสมาชิก</div>
        <form
          className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            search(draft);
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
              options={[{ value: "all", label: "ทุกพันธุ์" }, ...VARIETIES.map((item) => ({ value: item, label: item }))]}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            จากวันปลูก
            <DateField
              label="จากวันปลูก"
              className="mt-1"
              value={draft.plantedFrom}
              max={draft.plantedTo}
              onChange={(plantedFrom) =>
                setDraft({ ...draft, plantedFrom, plantedTo: draft.plantedTo && plantedFrom && draft.plantedTo < plantedFrom ? plantedFrom : draft.plantedTo })
              }
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ถึงวันปลูก
            <DateField
              label="ถึงวันปลูก"
              className="mt-1"
              value={draft.plantedTo}
              min={draft.plantedFrom}
              onChange={(plantedTo) => setDraft({ ...draft, plantedTo })}
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
            <SecondaryButton type="button" onClick={clear}>
              <Glyph icon={RotateCcw} />
              ล้าง
            </SecondaryButton>
          </div>
        </form>
      </div>
      {!searched && <p className="text-[14px] text-ink/60">ค้นหาสมาชิก แล้วจะแสดงแปลงของคนนั้น</p>}
      {searched && people.length === 0 && <p className="text-[14px] text-ink/60">ไม่พบสมาชิก</p>}
      {searched &&
        people.map((farmer) => {
          const mine = rounds.filter((row) => row.farmerId === farmer.id).sort(byHarvest);
          const group = groups.find((item) => item.id === farmer.groupId);
          const open = mine.find((row) => row.id === plotId) ?? null;
          return (
            <section key={farmer.id} className="mb-6 overflow-hidden rounded-[8px] border border-frame">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
                <div>
                  <div className="text-[16px] font-bold">{farmerName(farmer)}</div>
                  <div className="text-[14px]">
                    {group?.name ?? "ไม่มีกลุ่ม"} · {farmer.tel}
                  </div>
                </div>
                <SecondaryButton className="h-9" onClick={() => setAddingId(farmer.id)}>
                  <Glyph icon={Plus} />
                  เพิ่มแปลง
                </SecondaryButton>
              </div>
              <table className="w-full border-collapse text-left text-[14px]">
                <thead className="bg-table">
                  <tr>
                    {["แปลง", "พื้นที่", "พันธุ์", "วันปลูก", "กำหนดเก็บ", "ที่คาด", "สถานะ"].map((label) => (
                      <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mine.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-ink/60">
                        ยังไม่มีรอบที่กำลังปลูก
                      </td>
                    </tr>
                  )}
                  {mine.map((plot, index) => {
                    const mark = harvestMark(plot.harvestOn);
                    return (
                      <tr
                        key={plot.plantingId}
                        onClick={(event) => openRow(event, () => setPlotId(plot.id === plotId ? null : plot.id))}
                        className={rowTone(index, plot.id === plotId)}
                      >
                        <td className="px-5 py-3 font-bold">{plot.name}</td>
                        <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                        <td className="px-5 py-3">{plot.variety}</td>
                        <td className="px-5 py-3">{formatThaiDate(plot.plantedOn)}</td>
                        <td className="px-5 py-3">{formatThaiDate(plot.harvestOn)}</td>
                        <td className="px-5 py-3">{formatKg(plot.estKg)}</td>
                        <td className={`px-5 py-3 font-bold ${mark.className}`}>{mark.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {open && <PlanEditor key={open.plantingId} plot={open} onClose={() => setPlotId(null)} />}
            </section>
          );
        })}
      {adding && (
        <PlotDialog
          title={`เพิ่มแปลง · ${farmerName(adding)}`}
          name=""
          area=""
          onClose={() => setAddingId(null)}
          onSave={(name, areaRai, variety, schedule) => addPlot(adding.id, { name, areaRai, variety, ...schedule })}
        />
      )}
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
              onClick={(event) => openRow(event, () => onSelect(plot.id))}
              className={rowTone(index, picked)}
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

function PlanEditor({ plot, onClose }: { plot: SeasonRow; onClose: () => void }) {
  const { plantings, savePlot, savePlanting, removePlot, removePlanting } = useMill();
  const current = plantings.find((item) => item.id === plot.plantingId && !item.delivered) ?? null;
  const locked = plantings.some((item) => item.plotId === plot.id && item.delivered);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plot.name);
  const [area, setArea] = useState(String(plot.areaRai));
  const [variety, setVariety] = useState<Variety>(plot.variety);
  const [plantedOn, setPlantedOn] = useState(current?.plantedOn ?? plot.plantedOn);
  const [harvestOn, setHarvestOn] = useState(current?.harvestOn ?? plot.harvestOn);
  const [estKg, setEstKg] = useState(String(current?.estKg ?? plot.estKg));
  const [notice, setNotice] = useState<null | { tone: "confirm"; message: string; accept: () => void } | { tone: "success" | "error"; message: string; done?: () => void }>(null);
  const fieldClass = `${inputClass} mt-1`;
  const savedKg = String(current?.estKg ?? plot.estKg);
  const dirty =
    name !== plot.name ||
    area !== String(plot.areaRai) ||
    variety !== plot.variety ||
    plantedOn !== (current?.plantedOn ?? plot.plantedOn) ||
    harvestOn !== (current?.harvestOn ?? plot.harvestOn) ||
    estKg !== savedKg;

  useEffect(() => {
    setEditing(false);
    setName(plot.name);
    setArea(String(plot.areaRai));
    setVariety(plot.variety);
    setPlantedOn(current?.plantedOn ?? plot.plantedOn);
    setHarvestOn(current?.harvestOn ?? plot.harvestOn);
    setEstKg(String(current?.estKg ?? plot.estKg));
  }, [plot.id, plot.name, plot.areaRai, plot.variety, plot.plantedOn, plot.harvestOn, plot.estKg, current?.plantedOn, current?.harvestOn, current?.estKg]);

  function undo() {
    setName(plot.name);
    setArea(String(plot.areaRai));
    setVariety(plot.variety);
    setPlantedOn(current?.plantedOn ?? plot.plantedOn);
    setHarvestOn(current?.harvestOn ?? plot.harvestOn);
    setEstKg(savedKg);
    if (!dirty) setEditing(false);
  }

  function finish(error: string | null, success: string, done?: () => void) {
    setNotice(error ? { tone: "error", message: error } : { tone: "success", message: success, done });
  }

  return (
    <div className="border-t border-frame">
      <div className="flex items-center justify-between gap-3 bg-table px-6 py-4">
        <div>
          <div className="text-[16px] font-bold">แผนรอบ · {plot.name}</div>
          <div className="text-[14px]">
            {plot.areaRai} ไร่ · {plot.variety}
          </div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold text-bar">
          <X size={14} strokeWidth={1.75} aria-hidden />
          ปิด
        </button>
      </div>
      <form
        className="px-6 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
          const areaRai = Number(area.trim());
          const nextKg = Number(estKg.trim());
          if (!name.trim()) {
            setNotice({ tone: "error", message: "กรอกชื่อแปลง" });
            return;
          }
          if (!Number.isFinite(areaRai) || areaRai <= 0) {
            setNotice({ tone: "error", message: "พื้นที่ต้องมากกว่า 0" });
            return;
          }
          if (!plantedOn || !harvestOn) {
            setNotice({ tone: "error", message: "กรอกวันปลูกและกำหนดเก็บ" });
            return;
          }
          if (harvestOn < plantedOn) {
            setNotice({ tone: "error", message: "กำหนดเก็บต้องไม่ก่อนวันปลูก" });
            return;
          }
          if (!Number.isInteger(nextKg) || nextKg <= 0) {
            setNotice({ tone: "error", message: "ที่คาดต้องเป็นจำนวนเต็มมากกว่า 0" });
            return;
          }
          setNotice({
            tone: "confirm",
            message: `ยืนยันบันทึกแผน ${name.trim()}`,
            accept: () => {
              const plotError = savePlot(plot.id, { name, areaRai, variety });
              if (plotError) {
                setNotice({ tone: "error", message: plotError });
                return;
              }
              finish(savePlanting(plot.id, { plantingId: current?.id ?? plot.plantingId, plantedOn, harvestOn, estKg: nextKg }), "บันทึกแผนแล้ว", () =>
                setEditing(false),
              );
            },
          });
        }}
      >
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block text-[14px] font-bold leading-[1.4]">
              ชื่อแปลง
              <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              พื้นที่ (ไร่)
              <input value={area} inputMode="decimal" onChange={(event) => setArea(event.target.value)} className={fieldClass} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              พันธุ์
              <Select
                label="พันธุ์"
                className="mt-1"
                value={variety}
                onChange={(next) => setVariety(next as Variety)}
                options={VARIETIES.map((item) => ({ value: item, label: item }))}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              วันปลูก
              <DateField
                label="วันปลูก"
                className="mt-1"
                value={plantedOn}
                max={harvestOn}
                onChange={(next) => {
                  setPlantedOn(next);
                  if (harvestOn && next && harvestOn < next) setHarvestOn(next);
                }}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              กำหนดเก็บ
              <DateField label="กำหนดเก็บ" className="mt-1" value={harvestOn} min={plantedOn} onChange={setHarvestOn} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              ที่คาด (กก.)
              <input value={estKg} inputMode="numeric" onChange={(event) => setEstKg(event.target.value)} className={fieldClass} />
            </label>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[8px] border border-frame px-4 py-3">
              <div className="text-[12px] text-ink/70">วันปลูก</div>
              <div className="mt-1 text-[16px] font-bold">{formatThaiDate(plot.plantedOn)}</div>
            </div>
            <div className="rounded-[8px] border border-frame px-4 py-3">
              <div className="text-[12px] text-ink/70">กำหนดเก็บ</div>
              <div className="mt-1 text-[16px] font-bold">{formatThaiDate(plot.harvestOn)}</div>
            </div>
            <div className="rounded-[8px] border border-frame px-4 py-3">
              <div className="text-[12px] text-ink/70">ที่คาด</div>
              <div className="mt-1 text-[16px] font-bold tabular-nums">{formatKg(plot.estKg)}</div>
            </div>
          </div>
        )}
        {locked && <p className="mt-4 text-[14px]">รอบที่รับแล้วลบแปลงไม่ได้</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {editing ? (
            <>
              <SecondaryButton type="button" onClick={undo}>
                <Glyph icon={Undo2} />
                {dirty ? "เลิกทำ" : "ยกเลิก"}
              </SecondaryButton>
              <PrimaryButton type="submit">
                <Glyph icon={Save} />
                บันทึกแผน
              </PrimaryButton>
            </>
          ) : (
            <SecondaryButton type="button" onClick={() => setEditing(true)}>
              <Glyph icon={Pencil} />
              แก้ไขแผน
            </SecondaryButton>
          )}
          {current && (
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบแผนรอบ ${formatThaiDate(current.plantedOn)}`,
                  accept: () => finish(removePlanting(current.id), "ลบแผนแล้ว", onClose),
                })
              }
            >
              <Glyph icon={Trash2} />
              ลบแผน
            </SecondaryButton>
          )}
          {!locked && (
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบแปลง ${plot.name}`,
                  accept: () => finish(removePlot(plot.id), "ลบแปลงแล้ว", onClose),
                })
              }
            >
              <Glyph icon={Trash2} />
              ลบแปลง
            </SecondaryButton>
          )}
        </div>
      </form>
      {notice?.tone === "confirm" && (
        <ConfirmAlert
          message={notice.message}
          onCancel={() => setNotice(null)}
          onConfirm={() => {
            const accept = notice.accept;
            setNotice(null);
            accept();
          }}
        />
      )}
      {notice && notice.tone !== "confirm" && (
        <ResultAlert
          kind={notice.tone}
          message={notice.message}
          onClose={() => {
            const done = notice.done;
            setNotice(null);
            done?.();
          }}
        />
      )}
    </div>
  );
}
