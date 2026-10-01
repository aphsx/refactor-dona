"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useMill } from "@/components/store";
import { currentPlanting, farmerColor, farmerName, formatKg, formatThaiDate } from "@/lib/mill";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });

export function MapScreen() {
  const params = useSearchParams();
  const requested = params.get("farmer");
  const { plots, plantings, farmers, groups } = useMill();
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [farmerId, setFarmerId] = useState<string | null>(requested);
  const [plotId, setPlotId] = useState<string | null>(null);

  useEffect(() => {
    if (requested) setFarmerId(requested);
  }, [requested]);

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return farmers.filter((farmer) => {
      if (groupId === "none" && farmer.groupId != null) return false;
      if (groupId !== "all" && groupId !== "none" && farmer.groupId !== groupId) return false;
      if (!needle) return true;
      return `${farmerName(farmer)} ${farmer.tel}`.toLowerCase().includes(needle);
    });
  }, [farmers, groupId, query]);

  const visiblePlots = plots.filter((plot) => people.some((farmer) => farmer.id === plot.farmerId));
  const ungrouped = people.filter((farmer) => farmer.groupId == null).length;
  const selectedFarmer = farmers.find((farmer) => farmer.id === farmerId) ?? null;
  const farmerPlots = selectedFarmer ? plots.filter((plot) => plot.farmerId === selectedFarmer.id) : [];
  const selectedPlot = farmerPlots.find((plot) => plot.id === plotId) ?? null;

  const mapPlots = useMemo(
    () =>
      visiblePlots
        .filter((plot) => plot.polygon.length >= 4)
        .map((plot) => ({
          id: plot.id,
          name: plot.name,
          color: farmerId && plot.farmerId !== farmerId ? "#D5E3DC" : farmerColor(plot.farmerId),
          polygon: plot.polygon,
        })),
    [visiblePlots, farmerId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-frame px-7 text-[14px] font-light">
        dona
        <span className="px-2 text-ink/40">/</span>
        <span className="font-bold">แผนที่แปลง</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-frame">
          <div className="grid grid-cols-3 gap-2 border-b border-frame px-4 py-4">
            <Count label="คู่ค้า" value={people.length} />
            <Count label="แปลง" value={visiblePlots.length} />
            <Count label="ไม่มีกลุ่ม" value={ungrouped} />
          </div>
          <div className="space-y-3 border-b border-frame px-4 py-4">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นชื่อหรือเบอร์โทร"
                aria-label="ค้นคู่ค้า"
                className="h-10 w-full rounded-[4px] border border-line bg-white pl-9 pr-3 text-[14px] placeholder:text-ink/20"
              />
            </div>
            <select
              aria-label="กลุ่ม"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="h-10 w-full rounded-[4px] border border-line bg-white px-3 text-[14px]"
            >
              <option value="all">ทุกกลุ่ม</option>
              <option value="none">ไม่มีกลุ่ม</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {people.length === 0 && <li className="px-5 py-6 text-[14px] text-ink/60">ไม่พบคู่ค้า</li>}
            {people.map((farmer, index) => {
              const fields = plots.filter((plot) => plot.farmerId === farmer.id);
              const active = farmer.id === farmerId;
              return (
                <li key={farmer.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFarmerId(farmer.id);
                      setPlotId(null);
                    }}
                    className={`flex w-full items-center gap-3 px-5 py-3 text-left ${
                      active ? "bg-pick" : index % 2 === 1 ? "bg-table hover:bg-sub" : "bg-white hover:bg-sub"
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: farmerColor(farmer.id) }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{farmerName(farmer)}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink/60">
                        {groups.find((group) => group.id === farmer.groupId)?.name ?? "ไม่มีกลุ่ม"} · {fields.length} แปลง
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <section className="relative min-h-0">
          <FieldMap
            plots={mapPlots}
            selectedId={plotId}
            activeIds={farmerPlots.map((plot) => plot.id)}
            onSelect={(id) => {
              const plot = plots.find((item) => item.id === id);
              setPlotId(id);
              if (plot) setFarmerId(plot.farmerId);
            }}
          />
          {selectedFarmer && (
            <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-[320px] flex-col border-l border-frame bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
              <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">{farmerName(selectedFarmer)}</div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 text-[14px]">
                <Fact label="เบอร์โทร" value={selectedFarmer.tel} />
                <Fact label="กลุ่ม" value={groups.find((group) => group.id === selectedFarmer.groupId)?.name ?? "ไม่มีกลุ่ม"} />
                <Fact label="พันธุ์" value={selectedFarmer.variety} />
                <div>
                  <div className="font-bold leading-[1.4]">แปลงของคนนี้</div>
                  <ul className="mt-2 space-y-2">
                    {farmerPlots.map((plot) => {
                      const round = currentPlanting(plantings, plot.id);
                      return (
                        <li key={plot.id}>
                          <button
                            type="button"
                            onClick={() => setPlotId(plot.id)}
                            className={`w-full rounded-[8px] border px-3 py-2 text-left ${plot.id === plotId ? "border-brand bg-pick" : "border-frame"}`}
                          >
                            <span className="block font-bold">{plot.name}</span>
                            <span className="mt-1 block text-[12px] text-ink/70">
                              {plot.areaRai} ไร่
                              {round ? ` · เก็บ ${formatThaiDate(round.harvestOn)} · ${round.delivered ? "รับแล้ว" : formatKg(round.estKg)}` : " · ยังไม่มีแผน"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </aside>
          )}
        </section>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-sub px-2 py-2">
      <div className="text-[16px] font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-ink/60">{label}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-bold leading-[1.4]">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}
