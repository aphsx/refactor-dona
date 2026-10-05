"use client";

import dynamic from "next/dynamic";
import { placeCenter, placeLabel } from "@/lib/thai-place";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { CanEdit } from "@/components/can";
import type { FieldMapHandle } from "@/components/field-map";
import { useMill } from "@/components/store";
import { SearchSelect, matchesQuery } from "@/components/ui";
import { api, measureRingAreaRai } from "@/lib/api";
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
  type PlotBoundary,
  type Variety,
} from "@/lib/mill";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });

type StatusKey = "due" | "upcoming" | "none";

const STATUS: Record<StatusKey, { label: string; color: string }> = {
  due: { label: "ใกล้เก็บ", color: "#C05621" },
  upcoming: { label: "รอเก็บ", color: "#18B473" },
  none: { label: "ยังไม่มีแผน", color: "#B7C4D0" },
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
  const { groups, saveBoundary } = useMill();
  const mapRef = useRef<FieldMapHandle>(null);
  const [query, setQuery] = useState("");
  /** "" = all groups, "none" = ungrouped, else group uuid */
  const [groupId, setGroupId] = useState("");
  const [plotId, setPlotId] = useState<string | null>(requestedPlot);
  const [draft, setDraft] = useState<[number, number][] | null>(null);
  const [areaText, setAreaText] = useState("");
  const [boundaryError, setBoundaryError] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [boundaries, setBoundaries] = useState<PlotBoundary[]>([]);
  const [allDrawnCount, setAllDrawnCount] = useState(0);
  const [boundariesError, setBoundariesError] = useState("");
  const [detail, setDetail] = useState<Plot | null>(null);
  const [detailPlanting, setDetailPlanting] = useState<Planting | null>(null);

  useEffect(() => {
    setPlotId(requestedPlot);
  }, [requestedPlot]);

  useEffect(() => {
    setDraft(null);
    setBoundaryError("");
  }, [plotId]);

  // Load rings from API; pass groupId so the server filters (response rows may omit groupId).
  // Keep the previous rings until the next page arrives so the map does not flash empty / jump.
  useEffect(() => {
    let alive = true;
    setBoundariesError("");
    void api
      .listPlotBoundaries(groupId ? { groupId } : undefined)
      .then((items) => {
        if (!alive) return;
        setBoundaries(items);
        if (!groupId) setAllDrawnCount(items.length);
      })
      .catch(() => {
        if (alive) setBoundariesError("โหลดขอบเขตแปลงไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [groupId]);

  // Detail panel fetches full plot on select.
  useEffect(() => {
    if (!plotId) {
      setDetail(null);
      setDetailPlanting(null);
      return;
    }
    let alive = true;
    setDetail(null);
    setDetailPlanting(null);
    void Promise.all([api.getPlot(plotId), api.listPlantings({ plotId })]).then(([plot, plantingsForPlot]) => {
      if (!alive) return;
      setDetail(plot);
      setDetailPlanting(currentPlanting(plantingsForPlot, plotId));
    });
    return () => {
      alive = false;
    };
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

  const boundaryById = useMemo(() => {
    const map = new Map<string, [number, number][]>();
    for (const item of boundaries) map.set(item.id, item.polygon);
    return map;
  }, [boundaries]);

  const rows = useMemo<Row[]>(() => {
    const source = boundaries.length > 0 ? boundaries : [];
    return source.map((item) => {
      const farmer: Farmer = {
        id: item.farmerId,
        firstName: item.ownerName ?? "",
        lastName: "",
        tel: item.ownerTel ?? "",
        address: "",
        provinceId: 0,
        districtId: 0,
        subdistrictId: 0,
        groupId: item.groupId ?? null,
        groupName: item.groupName ?? "",
        deliveredKg: 0,
      };
      const plot: Plot = {
        id: item.id,
        farmerId: item.farmerId,
        name: item.name,
        areaRai: 0,
        provinceId: 0,
        districtId: 0,
        subdistrictId: 0,
        polygon: item.polygon,
        hasBoundary: true,
        ownerName: item.ownerName,
        groupName: item.groupName,
      };
      return { plot, farmer, planting: null, variety: null, status: "none", days: null };
    });
  }, [boundaries]);

  const groupOptions = useMemo(
    () => [
      { value: "", label: "ทุกกลุ่ม" },
      { value: "none", label: "ไม่มีกลุ่ม" },
      ...[...groups]
        .sort((a, b) => a.name.localeCompare(b.name, "th"))
        .map((group) => ({ value: group.id, label: group.name })),
    ],
    [groups],
  );

  const scoped = useMemo(() => {
    // Group is already applied by GET /plots/boundaries?groupId=…
    return rows.filter((row) => matchesQuery(query, `${row.plot.name} ${farmerName(row.farmer)} ${row.farmer.tel}`));
  }, [rows, query]);

  useEffect(() => {
    if (plotId && !scoped.some((row) => row.plot.id === plotId)) {
      setPlotId(null);
    }
  }, [plotId, scoped]);

  const listedIds = new Set(scoped.map((row) => row.plot.id));
  const selectedRow = rows.find((row) => row.plot.id === plotId) ?? null;
  const selected = selectedRow
    ? {
        ...selectedRow,
        planting: detailPlanting,
        variety: detailPlanting?.varietyId ?? null,
        status: !detailPlanting
          ? ("none" as const)
          : daysUntil(detailPlanting.harvestOn) <= 7
            ? ("due" as const)
            : ("upcoming" as const),
        days: detailPlanting ? daysUntil(detailPlanting.harvestOn) : null,
        plot: detail
          ? {
              ...detail,
              polygon: detail.polygon.length >= 4 ? detail.polygon : selectedRow.plot.polygon,
            }
          : selectedRow.plot,
        farmer: detail
          ? {
              ...selectedRow.farmer,
              id: detail.farmerId,
            }
          : selectedRow.farmer,
      }
    : null;
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
    setBoundaries((current) => {
      const prev = current.find((item) => item.id === selected.plot.id);
      const next = current.filter((item) => item.id !== selected.plot.id);
      next.push({
        id: selected.plot.id,
        farmerId: selected.plot.farmerId,
        name: selected.plot.name,
        ownerName: prev?.ownerName ?? selected.farmer.firstName,
        ownerTel: prev?.ownerTel ?? selected.farmer.tel,
        groupId: prev?.groupId ?? selected.farmer.groupId,
        groupName: prev?.groupName ?? selected.farmer.groupName,
        polygon: draft,
      });
      return next;
    });
    setDetail((current) => (current ? { ...current, polygon: draft, hasBoundary: true, areaRai } : current));
    setDraft(null);
  }

  const scopedDrawn = scoped.filter((row) => row.plot.polygon.length >= 4).length;
  const drawnCount = allDrawnCount || scopedDrawn;
  const showingAll = !query.trim() && !groupId;
  const mapPlots = rows
    .filter((row) => row.plot.polygon.length >= 4)
    .map((row) => ({
      id: row.plot.id,
      name: row.plot.name,
      color: "#5098BA",
      muted: !listedIds.has(row.plot.id),
      polygon: row.plot.polygon,
    }));
  const mapFocus = selected
    ? selected.plot.polygon.length >= 4
      ? { ...centroid(selected.plot.polygon), zoom: 16 }
      : placeCenter(selected.plot)
    : null;

  function showAll() {
    setQuery("");
    setGroupId("");
    setPlotId(null);
    setSuggestOpen(false);
  }

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
          focus={mapFocus}
          bottomInset={selected ? 180 : undefined}
        />
        <div className="absolute left-4 top-4 z-20 w-[300px] space-y-3 rounded-[8px] border border-frame bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink/60">
              {boundariesError
                ? boundariesError
                : showingAll
                  ? `ทั้งหมด ${drawnCount} แปลง`
                  : `แสดง ${scopedDrawn} จาก ${drawnCount} แปลง`}
            </p>
            <button
              type="button"
              onClick={showAll}
              disabled={showingAll && !plotId}
              className={`shrink-0 rounded-[6px] px-2.5 py-1 text-[13px] font-bold ${
                showingAll && !plotId
                  ? "bg-bar text-white"
                  : "border-2 border-brand bg-white text-brand hover:bg-pick"
              }`}
            >
              ทั้งหมด
            </button>
          </div>
          <label className="block text-[13px] font-bold">
            กลุ่ม
            <SearchSelect
              label="กลุ่ม"
              className="mt-1"
              value={groupId}
              onChange={(value) => {
                setGroupId(value);
                setPlotId(null);
              }}
              options={groupOptions}
              placeholder="เลือกกลุ่ม"
            />
          </label>
          <div className="relative">
            <Search size={16} strokeWidth={1.75} className="absolute left-3 top-3 text-ink/40" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSuggestOpen(true);
                setPlotId(null);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => {
                // ให้คลิกรายการด้านล่างทันก่อนปิด
                window.setTimeout(() => setSuggestOpen(false), 120);
              }}
              placeholder="ค้นชื่อแปลง เกษตรกร หรือเบอร์"
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
                      onClick={() => choosePlot(row.plot.id)}
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-pick"
                    >
                      <span className="text-[14px] font-bold">{row.plot.name}</span>
                      <span className="text-[12px] text-ink/60">
                        {farmerName(row.farmer)}
                        {row.farmer.tel ? ` · ${row.farmer.tel}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {suggestOpen && query.trim() && suggestions.length === 0 && (
              <div className="mt-1 rounded-[4px] border border-line px-3 py-2 text-[13px] text-ink/60">ไม่พบรายการ</div>
            )}
          </div>
        </div>
          {selected && (
            <div className="absolute inset-x-4 bottom-4 z-20 overflow-hidden rounded-[8px] border border-frame bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
              {draft == null ? (
                <>
                  <div className="flex items-center justify-between gap-3 bg-bar px-5 py-2.5 text-[15px] font-bold text-white">
                    รายละเอียดแปลง
                    <div className="flex shrink-0 items-center gap-2">
                      <CanEdit resource="plots">
                        <button
                          type="button"
                          onClick={() => {
                            setDraft([]);
                            setBoundaryError("");
                          }}
                          className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-white/25"
                        >
                          {selected.plot.polygon.length >= 4 ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
                        </button>
                      </CanEdit>
                      <button
                        type="button"
                        onClick={() => setPlotId(null)}
                        className="rounded-full bg-white px-2.5 py-1 text-[12px] text-bar"
                      >
                        ปิด
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-4 lg:grid-cols-5">
                    <label className={detailLabel}>
                      ชื่อแปลง
                      <input value={selected.plot.name} disabled className={detailField} />
                    </label>
                    <label className={detailLabel}>
                      สถานะ
                      <input value={timing(selected)} disabled className={detailField} />
                    </label>
                    <label className={detailLabel}>
                      พื้นที่ (ไร่)
                      <input value={String(selected.plot.areaRai)} disabled className={detailField} />
                    </label>
                    <label className={detailLabel}>
                      เจ้าของแปลง
                      <input value={farmerName(selected.farmer)} disabled className={detailField} />
                    </label>
                    <label className={detailLabel}>
                      กลุ่ม
                      <input
                        value={
                          selected.farmer.groupName ||
                          groups.find((group) => group.id === selected.farmer.groupId)?.name ||
                          (groupId && groupId !== "none" ? groups.find((group) => group.id === groupId)?.name : null) ||
                          "ไม่มีกลุ่ม"
                        }
                        disabled
                        className={detailField}
                      />
                    </label>
                    <label className={`${detailLabel} col-span-2 sm:col-span-2 lg:col-span-2`}>
                      ที่ตั้ง
                      <input
                        value={placeLabel(selected.plot) === "—" ? "ยังไม่ระบุที่ตั้ง" : placeLabel(selected.plot)}
                        disabled
                        className={detailField}
                      />
                    </label>
                    <label className={detailLabel}>
                      พิกัด
                      <input
                        value={
                          selected.plot.polygon.length >= 4
                            ? formatCoord(centroid(selected.plot.polygon))
                            : "ยังไม่มีรูป"
                        }
                        disabled
                        className={detailField}
                      />
                    </label>
                    <label className={detailLabel}>
                      พันธุ์
                      <input
                        value={selected.variety ? varietyName(selected.variety) : "ยังไม่ปลูก"}
                        disabled
                        className={detailField}
                      />
                    </label>
                    <label className={detailLabel}>
                      วันเก็บเกี่ยว
                      <input
                        value={selected.planting ? formatThaiDate(selected.planting.harvestOn) : "—"}
                        disabled
                        className={detailField}
                      />
                    </label>
                    <label className={detailLabel}>
                      คาดการณ์
                      <input
                        value={
                          selected.planting
                            ? selected.planting.estKg > 0
                              ? formatKg(selected.planting.estKg)
                              : "ยังไม่คาด"
                            : "—"
                        }
                        disabled
                        className={detailField}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <div className="px-5 py-3">
                  <DrawStep
                    name={selected.plot.name}
                    replacing={selected.plot.polygon.length >= 4}
                    draft={draft}
                    areaText={areaText}
                    error={boundaryError}
                    onArea={setAreaText}
                    onUndo={undoPoint}
                    onCloseShape={finishShape}
                    onRedraw={() => {
                      setDraft([]);
                      setAreaText("");
                      setBoundaryError("");
                    }}
                    onCancel={() => setDraft(null)}
                    onSave={saveShape}
                  />
                </div>
              )}
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
            <button type="button" onClick={() => void onSave()} className="inline-flex h-10 items-center rounded-[6px] bg-brand px-4 text-[14px] font-bold text-white hover:bg-brand-hover">
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

const mapButton = "inline-flex h-9 items-center rounded-[6px] border-2 border-brand bg-white px-3 text-[14px] font-bold text-brand disabled:border-[#D0D0D0] disabled:text-[#B0B0B0]";
const detailLabel = "block min-w-0 text-[12px] font-bold leading-[1.3]";
const detailField = "mt-1 h-8 w-full rounded-[4px] border border-line bg-white px-2.5 text-[13px] text-ink disabled:bg-[#E7E7E7]";

function timing(row: Row) {
  if (row.status === "none") return "ยังไม่มีแผน";
  if (row.days == null) return STATUS[row.status].label;
  if (row.days < 0) return `เลย ${Math.abs(row.days)} วัน`;
  if (row.days === 0) return "เก็บวันนี้";
  return `อีก ${row.days} วัน`;
}
