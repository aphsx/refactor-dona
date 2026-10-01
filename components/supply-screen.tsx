"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });
import { useMill } from "@/components/store";
import { Pagination, StatusTab, usePagination } from "@/components/ui";
import Link from "next/link";
import { daysUntil, farmerName, formatKg, formatThaiDate, plotColor } from "@/lib/mill";

type WindowFilter = "7 วันนี้" | "เดือนนี้" | "เก็บแล้ว";

export function SupplyScreen() {
  const params = useSearchParams();
  const focusFarmer = params.get("farmer");
  const { plots, farmers } = useMill();
  const [filter, setFilter] = useState<WindowFilter>("7 วันนี้");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return plots
      .filter((plot) => {
        if (focusFarmer) return plot.farmerId === focusFarmer;
        const days = daysUntil(plot.harvestOn);
        if (filter === "เก็บแล้ว") return plot.delivered;
        if (plot.delivered) return false;
        if (filter === "7 วันนี้") return days <= 7;
        return days <= 31;
      })
      .slice()
      .sort((a, b) => a.harvestOn.localeCompare(b.harvestOn));
  }, [plots, filter, focusFarmer]);

  const page = usePagination(visible, `${filter}:${focusFarmer ?? ""}`);
  const mapPlots = useMemo(
    () =>
      visible.map((plot) => ({
        id: plot.id,
        name: plot.name,
        color: plotColor(plot),
        polygon: plot.polygon,
      })),
    [visible],
  );
  const selected = plots.find((plot) => plot.id === selectedId) ?? null;
  const selectedFarmer = farmers.find((farmer) => farmer.id === selected?.farmerId);
  const expectedKg = visible.filter((plot) => !plot.delivered).reduce((sum, plot) => sum + plot.estKg, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-frame px-7">
        <div className="text-[14px] font-light">
          โรงสี
          <span className="px-2 text-ink/40">/</span>
          <span className="font-bold">แผนรับข้าว</span>
        </div>
        <div className="text-[14px] font-bold">
          {focusFarmer ? (
            <Link href="/supply" className="text-link underline">
              ดูทุกแปลง
            </Link>
          ) : (
            `คาดว่าจะเข้า ${formatKg(expectedKg)}`
          )}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-r border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">แปลงที่กำลังจะเข้า</div>
          {!focusFarmer && (
            <div className="flex items-end gap-1 px-4 pt-4">
              {(["7 วันนี้", "เดือนนี้", "เก็บแล้ว"] as WindowFilter[]).map((item) => (
                <StatusTab key={item} label={item} active={filter === item} onClick={() => setFilter(item)} />
              ))}
            </div>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto border-t border-frame">
            {page.rows.length === 0 && <li className="px-5 py-6 text-[14px] text-ink/60">ไม่มีแปลงในช่วงนี้</li>}
            {page.rows.map((plot, index) => {
              const farmer = farmers.find((item) => item.id === plot.farmerId);
              const active = plot.id === selectedId;
              return (
                <li key={plot.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(plot.id)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left ${
                      active ? "bg-pick" : index % 2 === 1 ? "bg-table hover:bg-sub" : "bg-white hover:bg-sub"
                    }`}
                  >
                    <span>
                      <span className="block text-[14px] font-bold">{plot.name}</span>
                      <span className="mt-0.5 block text-[12px] text-ink/60">
                        {farmer ? farmerName(farmer) : ""} · {formatThaiDate(plot.harvestOn)}
                      </span>
                    </span>
                    <span className="text-[14px] font-bold">{formatKg(plot.estKg)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            onPageChange={page.setPage}
            onPageSizeChange={page.setPageSize}
          />
        </section>
        <section className="relative min-h-0">
          <FieldMap plots={mapPlots} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="absolute bottom-4 left-4 z-10 w-48 rounded-[8px] border border-frame bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="mb-2 text-[12px] font-bold">กำหนดเข้า</div>
            <ul className="space-y-1.5 text-[12px]">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#F4A800]" /> 7 วันนี้
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" /> เดือนนี้
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-ok" /> รับแล้ว
              </li>
            </ul>
          </div>
          {selected && selectedFarmer && (
            <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-[340px] flex-col border-l border-frame bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
              <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">{selected.name}</div>
              <div className="space-y-4 p-6 text-[14px]">
                <Fact label="คู่ค้า" value={`${farmerName(selectedFarmer)} · ${selectedFarmer.tel}`} />
                <Fact label="พันธุ์" value={selectedFarmer.variety} />
                <Fact label="พื้นที่" value={`${selected.areaRai} ไร่`} />
                <Fact label="กำหนดเกี่ยว" value={formatThaiDate(selected.harvestOn)} />
                <Fact label="ปริมาณที่คาด" value={selected.delivered ? "รับเข้าแล้ว" : formatKg(selected.estKg)} />
              </div>
            </aside>
          )}
        </section>
      </div>
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
