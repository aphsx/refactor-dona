"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useMill } from "@/components/store";
import { SearchSelect, matchesQuery } from "@/components/ui";
import {
  centroid,
  closeRing,
  currentPlanting,
  daysUntil,
  farmerColor,
  farmerName,
  formatCoord,
  formatKg,
  formatRai,
  formatThaiDate,
  isClosedRing,
  openRing,
  polygonAreaRai,
  type Farmer,
  type Planting,
  type Plot,
  type Variety,
} from "@/lib/mill";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });

type StatusKey = "due" | "upcoming" | "delivered" | "none";
type Lens = "harvest" | "farmer" | "variety";

const STATUS: Record<StatusKey, { label: string; color: string }> = {
  due: { label: "ใกล้เก็บ", color: "#C05621" },
  upcoming: { label: "รอเก็บ", color: "#1A9D72" },
  delivered: { label: "รับแล้ว", color: "#6E8B97" },
  none: { label: "ยังไม่มีแผน", color: "#B7C4C0" },
};

const VARIETY_COLOR: Record<Variety, string> = {
  หอมมะลิ: "#1A9D72",
  ขาว: "#3B6787",
  เหนียว: "#B7791F",
};

const STATUS_ORDER: StatusKey[] = ["due", "upcoming", "delivered", "none"];

const LENSES: { id: Lens; label: string }[] = [
  { id: "harvest", label: "เก็บเกี่ยว" },
  { id: "farmer", label: "คู่ค้า" },
  { id: "variety", label: "พันธุ์" },
];

type Row = {
  plot: Plot;
  farmer: Farmer;
  planting: Planting | null;
  variety: Variety | null;
  status: StatusKey;
  days: number | null;
};

type Bucket = {
  key: string;
  label: string;
  color: string;
  rows: Row[];
};

export function MapScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("farmer");
  const requestedPlot = params.get("plot");
  const { plots, plantings, farmers, groups, saveBoundary } = useMill();
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [focusId, setFocusId] = useState<string | null>(requested);
  const [lens, setLens] = useState<Lens>("harvest");
  const [isolate, setIsolate] = useState<string | null>(null);
  const [plotId, setPlotId] = useState<string | null>(requestedPlot);
  const [draft, setDraft] = useState<[number, number][] | null>(null);
  const [areaText, setAreaText] = useState("");
  const [boundaryError, setBoundaryError] = useState("");

  useEffect(() => {
    setFocusId(requested);
  }, [requested]);

  useEffect(() => {
    setPlotId(requestedPlot);
  }, [requestedPlot]);

  useEffect(() => {
    setDraft(null);
    setBoundaryError("");
  }, [plotId]);

  useEffect(() => {
    if (draft && isClosedRing(draft)) {
      const measured = polygonAreaRai(draft);
      if (measured != null) setAreaText(String(measured));
    }
  }, [draft]);

  const rows = useMemo<Row[]>(() => {
    return plots.flatMap((plot) => {
      const farmer = farmers.find((item) => item.id === plot.farmerId);
      if (!farmer) return [];
      const planting = currentPlanting(plantings, plot.id);
      const days = planting && !planting.delivered ? daysUntil(planting.harvestOn) : null;
      const kind: StatusKey = !planting ? "none" : planting.delivered ? "delivered" : days != null && days <= 7 ? "due" : "upcoming";
      return [{ plot, farmer, planting, variety: planting?.variety ?? null, status: kind, days }];
    });
  }, [plots, plantings, farmers]);

  const needle = query.trim().toLowerCase();
  const scoped = rows.filter((row) => {
    if (focusId && row.farmer.id !== focusId) return false;
    if (groupId === "none" && row.farmer.groupId != null) return false;
    if (groupId !== "all" && groupId !== "none" && row.farmer.groupId !== groupId) return false;
    if (!needle || needle === "%") return true;
    return matchesQuery(query, `${row.plot.name} ${farmerName(row.farmer)} ${row.farmer.tel}`);
  });

  const sections = useMemo(() => groupRows(lens, scoped), [lens, scoped]);
  const open = sections.find((section) => section.key === isolate) ?? null;
  const listed = open ? open.rows : sections.flatMap((section) => section.rows);
  const listedIds = new Set(listed.map((row) => row.plot.id));
  const area = scoped.reduce((sum, row) => sum + row.plot.areaRai, 0);
  const focusFarmer = farmers.find((farmer) => farmer.id === focusId) ?? null;
  const selected = rows.find((row) => row.plot.id === plotId) ?? null;
  const siblings = selected ? rows.filter((row) => row.farmer.id === selected.farmer.id && row.plot.id !== selected.plot.id) : [];

  function paint(row: Row) {
    return bucketColor(lens, row);
  }

  function clearFocus() {
    setFocusId(null);
    router.replace("/map");
  }

  function chooseLens(next: Lens) {
    setLens(next);
    setIsolate(null);
  }

  function pinSection(key: string) {
    const next = isolate === key ? null : key;
    setIsolate(next);
    if (!next || !plotId) return;
    const row = rows.find((item) => item.plot.id === plotId);
    if (row && bucketKey(lens, row) !== next) setPlotId(null);
  }

  function choosePlot(id: string | null) {
    setPlotId(id);
    if (!id) return;
    const row = rows.find((item) => item.plot.id === id);
    if (!row) return;
    if (isolate && bucketKey(lens, row) !== isolate) setIsolate(null);
    if (focusId && row.farmer.id !== focusId) clearFocus();
  }

  function placePoint(lng: number, lat: number) {
    setBoundaryError("");
    setDraft((current) => {
      if (!current || isClosedRing(current)) return current;
      const ring = openRing(current);
      const next: [number, number] = [lng, lat];
      if (ring.length >= 3 && nearPoint(ring[0], next)) return closeRing(ring);
      return [...ring, next];
    });
  }

  function undoPoint() {
    setDraft((current) => {
      if (!current) return current;
      return openRing(current).slice(0, -1);
    });
  }

  function finishShape() {
    setDraft((current) => (current ? closeRing(openRing(current)) : current));
  }

  function saveShape() {
    if (!selected || !draft || !isClosedRing(draft)) return;
    const areaRai = Number(areaText.trim());
    if (!Number.isFinite(areaRai) || areaRai <= 0) {
      setBoundaryError("พื้นที่ต้องมากกว่า 0");
      return;
    }
    const error = saveBoundary(selected.plot.id, draft, areaRai);
    if (error) {
      setBoundaryError(error);
      return;
    }
    setDraft(null);
  }

  const mapPlots = rows
    .filter((row) => row.plot.polygon.length >= 4)
    .map((row) => ({
      id: row.plot.id,
      name: row.plot.name,
      color: paint(row),
      muted: !listedIds.has(row.plot.id),
      polygon: row.plot.polygon,
    }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-frame px-7 text-[14px] font-light">
        dona
        <span className="px-2 text-ink/40">/</span>
        <span className="font-bold">แผนที่แปลง</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-frame">
          <div className="space-y-3 border-b border-frame px-4 py-4">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นชื่อแปลง คู่ค้า หรือเบอร์โทร"
                aria-label="ค้นแปลง"
                className="h-10 w-full rounded-[4px] border border-line bg-white pl-9 pr-3 text-[14px] placeholder:text-ink/20"
              />
            </div>
            <SearchSelect
              label="กลุ่ม"
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
            <div>
              <div className="mb-2 text-[12px] font-bold">ดูตาม</div>
              <div role="radiogroup" aria-label="ดูตาม" className="grid grid-cols-3 gap-2">
                {LENSES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={lens === item.id}
                    onClick={() => chooseLens(item.id)}
                    className={`h-9 rounded-[6px] text-[14px] font-bold ${
                      lens === item.id ? "bg-bar text-white" : "border-2 border-brand bg-white text-brand"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {focusFarmer && (
            <div className="flex items-center gap-3 border-b border-frame bg-pick px-4 py-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: farmerColor(focusFarmer.id) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold">{farmerName(focusFarmer)}</span>
                <span className="block text-[12px] text-ink/70">เฉพาะแปลงของคนนี้</span>
              </span>
              <button type="button" onClick={clearFocus} className="shrink-0 text-[14px] font-bold text-link underline">
                ทุกแปลง
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-b border-frame px-4 py-2 text-[12px]">
            <span className="text-ink/60">
              {open
                ? `${open.label} · ${open.rows.length} จาก ${scoped.length} แปลง`
                : `${scoped.length} แปลง · ${area} ไร่`}
            </span>
            {open && (
              <button type="button" onClick={() => setIsolate(null)} className="shrink-0 font-bold text-link underline">
                ดูทั้งหมด
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {sections.length === 0 && <p className="px-5 py-6 text-[14px] text-ink/60">ไม่พบแปลงที่ตรงกับตัวกรอง</p>}
            {sections.map((section) => {
              const pinned = open?.key === section.key;
              const folded = open != null && !pinned;
              const rai = section.rows.reduce((sum, row) => sum + row.plot.areaRai, 0);
              return (
                <section key={section.key}>
                  <button
                    type="button"
                    aria-pressed={pinned}
                    onClick={() => pinSection(section.key)}
                    className={`sticky top-0 z-10 flex w-full items-center gap-2 border-b border-frame px-4 py-2 text-left ${
                      pinned ? "bg-pick" : "bg-sub"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: section.color }} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{section.label}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink/60">
                      {section.rows.length} · {rai} ไร่
                    </span>
                  </button>
                  {!folded && (
                    <ul>
                      {section.rows.map((row, index) => {
                        const active = row.plot.id === plotId;
                        return (
                          <li key={row.plot.id}>
                            <button
                              type="button"
                              onClick={() => choosePlot(row.plot.id)}
                              className={`flex w-full items-start gap-3 border-l-[3px] px-4 py-3 text-left ${
                                active
                                  ? "border-l-bar bg-pick"
                                  : index % 2 === 1
                                    ? "border-l-transparent bg-table hover:bg-sub"
                                    : "border-l-transparent bg-white hover:bg-sub"
                              }`}
                            >
                              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: paint(row) }} />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-[14px] font-bold">{row.plot.name}</span>
                                  <span className="shrink-0 text-[12px] font-bold" style={{ color: STATUS[row.status].color }}>
                                    {timing(row)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[12px] text-ink/60">{subtitle(row, lens)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </aside>
        <section className="relative min-h-0">
          <FieldMap
            plots={mapPlots}
            selectedId={plotId}
            onSelect={choosePlot}
            draft={draft}
            onDraftClick={draft != null && !isClosedRing(draft) ? placePoint : undefined}
          />
          {selected && (
            <div className="absolute inset-x-4 bottom-4 z-20 overflow-hidden rounded-[8px] border border-frame bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
              <div className="flex">
                <div className="w-1.5 shrink-0" style={{ background: paint(selected) }} />
                <div className="min-w-0 flex-1 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[16px] font-bold">{selected.plot.name}</h2>
                        <span className="text-[12px] font-bold" style={{ color: STATUS[selected.status].color }}>
                          {timing(selected)}
                        </span>
                      </div>
                      <p className="mt-1 text-[14px]">
                        {farmerName(selected.farmer)}
                        <span className="text-ink/40"> · </span>
                        {groups.find((group) => group.id === selected.farmer.groupId)?.name ?? "ไม่มีกลุ่ม"}
                      </p>
                      <p className="mt-1 text-[14px]">
                        {[selected.plot.subdistrict, selected.plot.district, selected.plot.province].filter(Boolean).join(" / ") || "ยังไม่ระบุที่ตั้ง"}
                      </p>
                      <p className="mt-1 text-[14px]">
                        {selected.plot.polygon.length >= 4 ? `พิกัด ${formatCoord(centroid(selected.plot.polygon))}` : "ยังไม่มีรูป"}
                        {polygonAreaRai(selected.plot.polygon) != null && (
                          <>
                            <span className="text-ink/40"> · </span>
                            จากรูป {formatRai(polygonAreaRai(selected.plot.polygon) ?? 0)}
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-[14px]">
                        {selected.plot.areaRai} ไร่
                        <span className="text-ink/40"> · </span>
                        {selected.variety ?? "ยังไม่ปลูก"}
                        {selected.planting && (
                          <>
                            <span className="text-ink/40"> · </span>
                            เก็บ {formatThaiDate(selected.planting.harvestOn)}
                            <span className="text-ink/40"> · </span>
                            {selected.planting.delivered ? "รับเข้าแล้ว" : `คาด ${formatKg(selected.planting.estKg)}`}
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="ปิดรายละเอียดแปลง"
                      onClick={() => setPlotId(null)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-ink"
                    >
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {draft == null && (
                      <button type="button" onClick={() => { setDraft([]); setBoundaryError(""); }} className={mapButton}>
                        วาดขอบเขต
                      </button>
                    )}
                    {draft != null && !isClosedRing(draft) && (
                      <>
                        <span className="text-[14px]">{openRing(draft).length} จุด · คลิกบนแผนที่ คลิกจุดแรกเพื่อปิดรูป</span>
                        <button type="button" onClick={undoPoint} disabled={openRing(draft).length === 0} className={mapButton}>
                          ลบจุด
                        </button>
                        <button type="button" onClick={finishShape} disabled={openRing(draft).length < 3} className={mapButton}>
                          ปิดรูป
                        </button>
                        <button type="button" onClick={() => setDraft(null)} className={mapButton}>
                          ยกเลิก
                        </button>
                      </>
                    )}
                    {draft != null && isClosedRing(draft) && (
                      <>
                        <label className="text-[14px] font-bold">
                          พื้นที่ (ไร่)
                          <input
                            value={areaText}
                            inputMode="decimal"
                            onChange={(event) => setAreaText(event.target.value)}
                            className="ml-2 h-9 w-24 rounded-[4px] border border-line px-2 font-normal"
                          />
                        </label>
                        <button type="button" onClick={saveShape} className="inline-flex h-9 items-center rounded-[6px] bg-brand px-3 text-[14px] font-bold text-white">
                          บันทึกขอบเขต
                        </button>
                        <button type="button" onClick={() => { setDraft([]); setAreaText(""); setBoundaryError(""); }} className={mapButton}>
                          วาดใหม่
                        </button>
                        <button type="button" onClick={() => setDraft(null)} className={mapButton}>
                          ยกเลิก
                        </button>
                      </>
                    )}
                    {boundaryError && <p className="w-full text-[14px] text-danger">{boundaryError}</p>}
                  </div>
                  {siblings.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-ink/60">แปลงอื่นของคนนี้</span>
                      {siblings.map((row) => (
                        <button
                          key={row.plot.id}
                          type="button"
                          onClick={() => choosePlot(row.plot.id)}
                          className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-frame px-3 text-[14px] font-bold hover:bg-sub"
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: paint(row) }} />
                          {row.plot.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function nearPoint(a: [number, number], b: [number, number]) {
  const lng = a[0] - b[0];
  const lat = a[1] - b[1];
  return lng * lng + lat * lat < 0.00008 * 0.00008;
}

const mapButton = "inline-flex h-9 items-center rounded-[6px] border-2 border-brand bg-white px-3 text-[14px] font-bold text-brand disabled:border-[#D0D0D0] disabled:text-[#B0B0B0]";

function bucketKey(lens: Lens, row: Row) {
  if (lens === "farmer") return row.farmer.id;
  if (lens === "variety") return row.variety ?? "none";
  return row.status;
}

function bucketColor(lens: Lens, row: Row) {
  if (lens === "farmer") return farmerColor(row.farmer.id);
  if (lens === "variety") return row.variety ? VARIETY_COLOR[row.variety] : STATUS.none.color;
  return STATUS[row.status].color;
}

function groupRows(lens: Lens, rows: Row[]): Bucket[] {
  const ordered = rows.slice().sort(byUrgency);
  if (lens === "harvest") {
    return STATUS_ORDER.flatMap((key) => {
      const members = ordered.filter((row) => row.status === key);
      if (members.length === 0) return [];
      return [{ key, label: STATUS[key].label, color: STATUS[key].color, rows: members }];
    });
  }
  if (lens === "variety") {
    const planted = (Object.keys(VARIETY_COLOR) as Variety[]).flatMap((variety) => {
      const members = ordered.filter((row) => row.variety === variety);
      if (members.length === 0) return [];
      return [{ key: variety, label: variety, color: VARIETY_COLOR[variety], rows: members }];
    });
    const bare = ordered.filter((row) => row.variety == null);
    return bare.length === 0 ? planted : [...planted, { key: "none", label: "ยังไม่ปลูก", color: STATUS.none.color, rows: bare }];
  }
  const farmers = ordered.filter((row, index, list) => list.findIndex((item) => item.farmer.id === row.farmer.id) === index);
  farmers.sort((a, b) => {
    const left = soonest(ordered, a.farmer.id);
    const right = soonest(ordered, b.farmer.id);
    if (left != null && right != null && left !== right) return left - right;
    if (left != null && right == null) return -1;
    if (left == null && right != null) return 1;
    return farmerName(a.farmer).localeCompare(farmerName(b.farmer), "th");
  });
  return farmers.map((row) => ({
    key: row.farmer.id,
    label: farmerName(row.farmer),
    color: farmerColor(row.farmer.id),
    rows: ordered.filter((item) => item.farmer.id === row.farmer.id),
  }));
}

function soonest(rows: Row[], farmerId: string) {
  const days = rows.filter((row) => row.farmer.id === farmerId && row.days != null).map((row) => row.days as number);
  return days.length === 0 ? null : Math.min(...days);
}

function byUrgency(a: Row, b: Row) {
  if (a.days != null && b.days != null && a.days !== b.days) return a.days - b.days;
  if (a.days != null && b.days == null) return -1;
  if (a.days == null && b.days != null) return 1;
  return a.plot.name.localeCompare(b.plot.name, "th");
}

function subtitle(row: Row, lens: Lens) {
  const variety = row.variety ?? "ยังไม่ปลูก";
  if (lens === "farmer") return `${row.plot.areaRai} ไร่ · ${variety}`;
  if (lens === "variety") return `${farmerName(row.farmer)} · ${row.plot.areaRai} ไร่`;
  return `${farmerName(row.farmer)} · ${row.plot.areaRai} ไร่ · ${variety}`;
}

function timing(row: Row) {
  if (row.status === "none") return "ยังไม่มีแผน";
  if (row.status === "delivered") return "รับแล้ว";
  if (row.days == null) return STATUS[row.status].label;
  if (row.days < 0) return `เลย ${Math.abs(row.days)} วัน`;
  if (row.days === 0) return "เก็บวันนี้";
  return `อีก ${row.days} วัน`;
}
