"use client";

import dynamic from "next/dynamic";
import { placeCenter, placeLabel } from "@/lib/thai-place";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { CanEdit } from "@/components/can";
import type { FieldMapHandle } from "@/components/field-map";
import { useMill } from "@/components/store";
import { SuggestInput, matchesQuery } from "@/components/ui";
import { measureRingAreaRai } from "@/lib/api";
import {
  centroid,
  closeRing,
  currentPlanting,
  daysUntil,
  farmerName,
  formatCoord,
  formatKg,
  formatRai,
  formatThaiDate,
  varietyName,
  isClosedRing,
  openRing,
  type Farmer,
  type Planting,
  type Plot,
  type Variety,
} from "@/lib/mill";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });

type StatusKey = "due" | "upcoming" | "none";

const STATUS: Record<StatusKey, { label: string; color: string }> = {
  due: { label: "ใกล้เก็บ", color: "#C05621" },
  upcoming: { label: "รอเก็บ", color: "#50AB6D" },
  none: { label: "ยังไม่มีแผน", color: "#A8B8B4" },
};

type Row = {
  plot: Plot;
  farmer: Farmer;
  planting: Planting | null;
  variety: Variety | null;
  status: StatusKey;
  days: number | null;
};

export function MapScreen() {
  const params = useSearchParams();
  const requestedPlot = params.get("plot");
  const { plots, plantings, farmers, groups, saveBoundary } = useMill();
  const mapRef = useRef<FieldMapHandle>(null);
  const [query, setQuery] = useState("");
  const [groupText, setGroupText] = useState("");
  const [plotId, setPlotId] = useState<string | null>(requestedPlot);
  const [draft, setDraft] = useState<[number, number][] | null>(null);
  const [areaText, setAreaText] = useState("");
  const [boundaryError, setBoundaryError] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => {
    setPlotId(requestedPlot);
  }, [requestedPlot]);

  useEffect(() => {
    setDraft(null);
    setBoundaryError("");
  }, [plotId]);

  useEffect(() => {
    if (!draft || !isClosedRing(draft)) return;
    let alive = true;
    void measureRingAreaRai(draft).then((measured) => {
      if (alive && measured != null) setAreaText(String(measured));
    });
    return () => {
      alive = false;
    };
  }, [draft]);

  const rows = useMemo<Row[]>(() => {
    return plots.flatMap((plot) => {
      const farmer = farmers.find((item) => item.id === plot.farmerId);
      if (!farmer) return [];
      const planting = currentPlanting(plantings, plot.id);
      const days = planting ? daysUntil(planting.harvestOn) : null;
      const kind: StatusKey = !planting ? "none" : days != null && days <= 7 ? "due" : "upcoming";
      return [{ plot, farmer, planting, variety: planting?.varietyId ?? null, status: kind, days }];
    });
  }, [plots, plantings, farmers]);

  const groupNames = useMemo(
    () => [...groups].map((group) => group.name).sort((a, b) => a.localeCompare(b, "th")),
    [groups],
  );

  const scoped = rows.filter((row) => {
    const groupName = groups.find((group) => group.id === row.farmer.groupId)?.name ?? "";
    if (groupText.trim()) {
      if (groupText.trim() === "ไม่มีกลุ่ม") {
        if (row.farmer.groupId != null) return false;
      } else if (!matchesQuery(groupText, groupName)) {
        return false;
      }
    }
    return matchesQuery(query, `${row.plot.name} ${farmerName(row.farmer)} ${row.farmer.tel}`);
  });
  const listedIds = new Set(scoped.map((row) => row.plot.id));
  const selected = rows.find((row) => row.plot.id === plotId) ?? null;
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return scoped.slice(0, 8);
  }, [scoped, query]);

  function choosePlot(id: string | null) {
    setPlotId(id);
    setSuggestOpen(false);
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

  async function saveShape() {
    if (!selected || !draft || !isClosedRing(draft)) return;
    const areaRai = Number(areaText.trim());
    if (!Number.isFinite(areaRai) || areaRai <= 0) {
      setBoundaryError("พื้นที่ต้องมากกว่า 0");
      return;
    }
    const preview = (await mapRef.current?.capturePreview(draft)) ?? null;
    const error = await saveBoundary(selected.plot.id, draft, areaRai, preview);
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
      color: "#50AB6D",
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
      <div className="relative min-h-0 flex-1">
        <FieldMap
          ref={mapRef}
          plots={mapPlots}
          selectedId={plotId}
          onSelect={choosePlot}
          draft={draft}
          onDraftClick={draft != null && !isClosedRing(draft) ? placePoint : undefined}
          focus={selected ? placeCenter(selected.plot) : null}
        />
        <div className="absolute left-4 top-4 z-20 w-[300px] space-y-3 rounded-[8px] border border-frame bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <div className="relative">
            <Search size={16} strokeWidth={1.75} className="absolute left-3 top-3 text-ink/40" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => {
                // ให้คลิกรายการด้านล่างทันก่อนปิด
                window.setTimeout(() => setSuggestOpen(false), 120);
              }}
              placeholder="ค้นชื่อแปลง หรือเกษตรกร"
              aria-label="ค้นแปลง"
              className="h-10 w-full rounded-[4px] border border-line bg-white pl-9 pr-3 text-[14px] placeholder:text-ink/20"
            />
            {suggestOpen && query.trim() && suggestions.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-[4px] border border-line bg-white py-1">
                {suggestions.map((row) => (
                  <li key={row.plot.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(`${row.plot.name} · ${farmerName(row.farmer)}`);
                        choosePlot(row.plot.id);
                      }}
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-pick"
                    >
                      <span className="text-[14px] font-bold">{row.plot.name}</span>
                      <span className="text-[12px] text-ink/60">{farmerName(row.farmer)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {suggestOpen && query.trim() && suggestions.length === 0 && (
              <div className="mt-1 rounded-[4px] border border-line px-3 py-2 text-[13px] text-ink/60">ไม่พบรายการ</div>
            )}
          </div>
          <label className="block text-[13px] font-bold">
            กลุ่ม
            <SuggestInput
              label="กลุ่ม"
              className="mt-1"
              value={groupText}
              onChange={setGroupText}
              suggestions={["ไม่มีกลุ่ม", ...groupNames]}
            />
          </label>
        </div>
          {selected && (
            <div className="absolute inset-x-4 bottom-4 z-20 overflow-hidden rounded-[8px] border border-frame bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
              <div className="flex">
                <div className="w-1.5 shrink-0 bg-brand" />
                <div className="min-w-0 flex-1 px-5 py-4">
                  {draft == null ? (
                    <>
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
                            {placeLabel(selected.plot) === "—" ? "ยังไม่ระบุที่ตั้ง" : placeLabel(selected.plot)}
                          </p>
                          <p className="mt-1 text-[14px]">
                            {selected.plot.polygon.length >= 4 ? `พิกัด ${formatCoord(centroid(selected.plot.polygon))}` : "ยังไม่มีรูป"}
                          </p>
                          <p className="mt-1 text-[14px]">
                            {formatRai(selected.plot.areaRai)}
                            <span className="text-ink/40"> · </span>
                            {selected.variety ? varietyName(selected.variety) : "ยังไม่ปลูก"}
                            {selected.planting && (
                              <>
                                <span className="text-ink/40"> · </span>
                                เก็บ {formatThaiDate(selected.planting.harvestOn)}
                                <span className="text-ink/40"> · </span>
                                {selected.planting.estKg > 0 ? `คาด ${formatKg(selected.planting.estKg)}` : "ยังไม่คาด"}
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
                      <CanEdit resource="plots">
                        <div className="mt-3">
                          <button type="button" onClick={() => { setDraft([]); setBoundaryError(""); }} className={mapButton}>
                            {selected.plot.polygon.length >= 4 ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
                          </button>
                        </div>
                      </CanEdit>
                    </>
                  ) : (
                    <DrawStep
                      name={selected.plot.name}
                      replacing={selected.plot.polygon.length >= 4}
                      draft={draft}
                      areaText={areaText}
                      error={boundaryError}
                      onArea={setAreaText}
                      onUndo={undoPoint}
                      onCloseShape={finishShape}
                      onRedraw={() => { setDraft([]); setAreaText(""); setBoundaryError(""); }}
                      onCancel={() => setDraft(null)}
                      onSave={saveShape}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

function DrawStep({
  name,
  replacing,
  draft,
  areaText,
  error,
  onArea,
  onUndo,
  onCloseShape,
  onRedraw,
  onCancel,
  onSave,
}: {
  name: string;
  replacing: boolean;
  draft: [number, number][];
  areaText: string;
  error: string;
  onArea: (value: string) => void;
  onUndo: () => void;
  onCloseShape: () => void;
  onRedraw: () => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}) {
  const closed = isClosedRing(draft);
  const count = openRing(draft).length;
  const hint = count === 0 ? "คลิกบนแผนที่เพื่อวางจุดแรก" : count < 3 ? `วางแล้ว ${count} จุด ต้องมีอย่างน้อย 3 จุด` : `วางแล้ว ${count} จุด คลิกจุดแรกหรือกดปิดรูป`;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">{closed ? "ยืนยันรูป" : replacing ? "แก้ไขขอบเขต" : "วาดขอบเขต"} · {name}</h2>
          <p className="mt-1 text-[14px]">
            {closed
              ? `${areaText ? formatRai(Number(areaText)) : "กำลังคำนวณพื้นที่…"} (WGS84) แก้ได้ถ้าไม่ตรงโฉนด`
              : hint}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="shrink-0 text-[14px] font-bold text-link underline">
          ยกเลิก
        </button>
      </div>
      {closed ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[14px] font-bold">
            พื้นที่ (ไร่)
            <input
              value={areaText}
              inputMode="decimal"
              onChange={(event) => onArea(event.target.value)}
              className="mt-1 block h-10 w-28 rounded-[4px] border border-line px-3 font-normal"
            />
          </label>
          <CanEdit resource="plots">
            <button type="button" onClick={() => void onSave()} className="inline-flex h-10 items-center rounded-[6px] bg-bar px-4 text-[14px] font-bold text-white hover:bg-sidebar">
              บันทึกขอบเขต
            </button>
          </CanEdit>
          <button type="button" onClick={onRedraw} className={mapButton}>
            วาดใหม่
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {count > 0 && (
            <button type="button" onClick={onUndo} className={mapButton}>
              ลบจุด
            </button>
          )}
          {count >= 3 && (
            <button type="button" onClick={onCloseShape} className={mapButton}>
              ปิดรูป
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[14px] text-danger">{error}</p>}
    </>
  );
}

function nearPoint(a: [number, number], b: [number, number]) {
  const lng = a[0] - b[0];
  const lat = a[1] - b[1];
  return lng * lng + lat * lat < 0.00008 * 0.00008;
}

const mapButton = "inline-flex h-9 items-center rounded-[6px] border-2 border-bar bg-white px-3 text-[14px] font-bold text-bar disabled:border-[#D0D0D0] disabled:text-[#B0B0B0]";

function timing(row: Row) {
  if (row.status === "none") return "ยังไม่มีแผน";
  if (row.days == null) return STATUS[row.status].label;
  if (row.days < 0) return `เลย ${Math.abs(row.days)} วัน`;
  if (row.days === 0) return "เก็บวันนี้";
  return `อีก ${row.days} วัน`;
}
