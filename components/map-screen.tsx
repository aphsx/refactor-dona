"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useMill } from "@/components/store";
import { SearchSelect, matchesQuery } from "@/components/ui";
import {
  currentPlanting,
  daysUntil,
  farmerColor,
  farmerName,
  formatKg,
  formatThaiDate,
  type Farmer,
  type Planting,
  type Plot,
  type Variety,
} from "@/lib/mill";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });

type StatusKey = "due" | "upcoming" | "delivered" | "none";
type ColorMode = "status" | "farmer" | "variety";
type StatusFilter = "all" | StatusKey;

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

type Row = {
  plot: Plot;
  farmer: Farmer;
  planting: Planting | null;
  status: StatusKey;
  days: number | null;
};

export function MapScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("farmer");
  const { plots, plantings, farmers, groups } = useMill();
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [focusId, setFocusId] = useState<string | null>(requested);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [colorMode, setColorMode] = useState<ColorMode>("status");
  const [plotId, setPlotId] = useState<string | null>(null);

  useEffect(() => {
    setFocusId(requested);
  }, [requested]);

  const rows = useMemo<Row[]>(() => {
    return plots.flatMap((plot) => {
      const farmer = farmers.find((item) => item.id === plot.farmerId);
      if (!farmer) return [];
      const planting = currentPlanting(plantings, plot.id);
      const days = planting && !planting.delivered ? daysUntil(planting.harvestOn) : null;
      const kind: StatusKey = !planting ? "none" : planting.delivered ? "delivered" : days != null && days <= 7 ? "due" : "upcoming";
      return [{ plot, farmer, planting, status: kind, days }];
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

  const listed = scoped
    .filter((row) => status === "all" || row.status === status)
    .sort((a, b) => {
      const rank = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (rank !== 0) return rank;
      if (a.days != null && b.days != null && a.days !== b.days) return a.days - b.days;
      return a.plot.name.localeCompare(b.plot.name, "th");
    });

  const listedIds = new Set(listed.map((row) => row.plot.id));
  const area = listed.reduce((sum, row) => sum + row.plot.areaRai, 0);
  const focusFarmer = farmers.find((farmer) => farmer.id === focusId) ?? null;
  const selected = rows.find((row) => row.plot.id === plotId) ?? null;
  const siblings = selected ? rows.filter((row) => row.farmer.id === selected.farmer.id && row.plot.id !== selected.plot.id) : [];

  function paint(row: Row) {
    if (colorMode === "farmer") return farmerColor(row.farmer.id);
    if (colorMode === "variety") return VARIETY_COLOR[row.plot.variety];
    return STATUS[row.status].color;
  }

  function clearFocus() {
    setFocusId(null);
    router.replace("/map");
  }

  function choosePlot(id: string | null) {
    setPlotId(id);
    if (!id) return;
    const row = rows.find((item) => item.plot.id === id);
    if (!row) return;
    if (status !== "all" && row.status !== status) setStatus("all");
    if (focusId && row.farmer.id !== focusId) clearFocus();
  }

  const legend =
    colorMode === "farmer"
      ? scoped
          .filter((row, index, list) => list.findIndex((item) => item.farmer.id === row.farmer.id) === index)
          .map((row) => ({ key: row.farmer.id, label: farmerName(row.farmer), color: farmerColor(row.farmer.id) }))
      : colorMode === "variety"
        ? (Object.keys(VARIETY_COLOR) as Variety[])
            .filter((variety) => scoped.some((row) => row.plot.variety === variety))
            .map((variety) => ({ key: variety, label: variety, color: VARIETY_COLOR[variety] }))
        : STATUS_ORDER.filter((key) => rows.some((row) => row.status === key)).map((key) => ({
            key,
            label: STATUS[key].label,
            color: STATUS[key].color,
          }));

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
          <div className="space-y-3 border-b border-frame px-4 py-4">
            <div>
              <div className="mb-2 text-[12px] font-bold">สีแปลง</div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["status", "สถานะ"],
                    ["farmer", "คู่ค้า"],
                    ["variety", "พันธุ์"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={colorMode === mode}
                    onClick={() => setColorMode(mode)}
                    className={`h-9 rounded-[6px] text-[14px] font-bold ${
                      colorMode === mode ? "bg-bar text-white" : "border-2 border-brand bg-white text-brand"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {legend.map((item) => (
                <span key={item.key} className="inline-flex items-center gap-1.5 text-[12px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-frame px-4 py-3">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")} label="ทั้งหมด" count={scoped.length} />
            {STATUS_ORDER.filter((key) => scoped.some((row) => row.status === key)).map((key) => (
              <FilterChip
                key={key}
                active={status === key}
                onClick={() => setStatus((current) => (current === key ? "all" : key))}
                label={STATUS[key].label}
                count={scoped.filter((row) => row.status === key).length}
                color={STATUS[key].color}
              />
            ))}
          </div>
          <div className="px-5 py-2 text-[12px] text-ink/60">
            {listed.length} แปลง · {area} ไร่
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {listed.length === 0 && <li className="px-5 py-6 text-[14px] text-ink/60">ไม่พบแปลงที่ตรงกับตัวกรอง</li>}
            {listed.map((row, index) => {
              const active = row.plot.id === plotId;
              return (
                <li key={row.plot.id}>
                  <button
                    type="button"
                    onClick={() => choosePlot(row.plot.id)}
                    className={`flex w-full items-start gap-3 border-l-[3px] px-5 py-3 text-left ${
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
                      <span className="mt-0.5 block truncate text-[12px] text-ink/60">
                        {farmerName(row.farmer)} · {row.plot.areaRai} ไร่ · {row.plot.variety}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className="relative min-h-0">
          <FieldMap plots={mapPlots} selectedId={plotId} onSelect={choosePlot} />
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
                        <span className="text-ink/40"> · </span>
                        {selected.farmer.tel}
                      </p>
                      <p className="mt-1 text-[14px]">
                        {selected.plot.areaRai} ไร่
                        <span className="text-ink/40"> · </span>
                        {selected.plot.variety}
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

function timing(row: Row) {
  if (row.status === "none") return "ยังไม่มีแผน";
  if (row.status === "delivered") return "รับแล้ว";
  if (row.days == null) return STATUS[row.status].label;
  if (row.days < 0) return `เลย ${Math.abs(row.days)} วัน`;
  if (row.days === 0) return "เก็บวันนี้";
  return `อีก ${row.days} วัน`;
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-bold ${
        active ? "bg-pick text-ink" : "border border-frame bg-white text-ink"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className="tabular-nums text-ink/60">{count}</span>
    </button>
  );
}
