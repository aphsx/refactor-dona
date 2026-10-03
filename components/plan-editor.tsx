"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, Undo2, X } from "lucide-react";
import { CanDelete, CanEdit } from "@/components/can";
import { useMill } from "@/components/store";
import { ConfirmAlert, DateField, Glyph, PrimaryButton, ResultAlert, SecondaryButton, Select, inputClass } from "@/components/ui";
import { VARIETIES, formatRai, formatThaiDate, polygonAreaRai, varietyName, type Variety } from "@/lib/mill";

export type PlanRow = {
  id: string;
  plantingId: string;
  name: string;
  areaRai: number;
  varietyId: Variety | null;
  plantedOn: string;
  harvestOn: string;
  estKg: number;
};

function kgField(value: number) {
  return value > 0 ? String(value) : "";
}

function RequiredMark() {
  return <span className="text-danger"> *</span>;
}

export function PlanEditor({ plot, onClose }: { plot: PlanRow; onClose: () => void }) {
  const { plantings, plots, savePlot, savePlanting, removePlot, removePlanting } = useMill();
  const measured = polygonAreaRai(plots.find((item) => item.id === plot.id)?.polygon ?? []);
  const current = plantings.find((item) => item.id === plot.plantingId && !item.delivered) ?? null;
  const locked = plantings.some((item) => item.plotId === plot.id && item.delivered);
  const fresh = !plot.plantingId;
  const [editing, setEditing] = useState(fresh);
  const [area, setArea] = useState(String(plot.areaRai));
  const [variety, setVariety] = useState<Variety | "">(plot.varietyId ?? "");
  const [plantedOn, setPlantedOn] = useState(current?.plantedOn ?? plot.plantedOn);
  const [harvestOn, setHarvestOn] = useState(current?.harvestOn ?? plot.harvestOn);
  const [estKg, setEstKg] = useState(kgField(fresh ? 0 : (current?.estKg ?? plot.estKg)));
  const [notice, setNotice] = useState<null | { tone: "confirm"; message: string; accept: () => void } | { tone: "success" | "error"; message: string; done?: () => void }>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const savedKg = kgField(plot.plantingId ? (current?.estKg ?? plot.estKg) : 0);
  const dirty =
    area !== String(plot.areaRai) ||
    variety !== (plot.varietyId ?? "") ||
    plantedOn !== (current?.plantedOn ?? plot.plantedOn) ||
    harvestOn !== (current?.harvestOn ?? plot.harvestOn) ||
    estKg !== savedKg;

  useEffect(() => {
    setEditing(!plot.plantingId);
    setArea(String(plot.areaRai));
    setVariety(plot.varietyId ?? "");
    setPlantedOn(current?.plantedOn ?? plot.plantedOn);
    setHarvestOn(current?.harvestOn ?? plot.harvestOn);
    setEstKg(kgField(plot.plantingId ? (current?.estKg ?? plot.estKg) : 0));
  }, [plot.id, plot.plantingId, plot.areaRai, plot.varietyId, plot.plantedOn, plot.harvestOn, plot.estKg, current?.plantedOn, current?.harvestOn, current?.estKg]);

  function undo() {
    setArea(String(plot.areaRai));
    setVariety(plot.varietyId ?? "");
    setPlantedOn(current?.plantedOn ?? plot.plantedOn);
    setHarvestOn(current?.harvestOn ?? plot.harvestOn);
    setEstKg(savedKg);
    if (!dirty) setEditing(false);
  }

  function finish(error: string | null, success: string, done?: () => void) {
    setNotice(error ? { tone: "error", message: error } : { tone: "success", message: success, done });
  }

  return (
    <div className="border-t border-frame bg-white">
      <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div>
          <div className="text-[16px] font-bold">แผนรอบ · {plot.name}</div>
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
          const trimmedKg = estKg.trim();
          const nextKg = trimmedKg === "" ? 0 : Number(trimmedKg);
          if (!variety) {
            setNotice({ tone: "error", message: "เลือกพันธุ์" });
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
          if (trimmedKg !== "" && (!Number.isInteger(nextKg) || nextKg <= 0)) {
            setNotice({ tone: "error", message: "ที่คาดต้องเป็นจำนวนเต็มมากกว่า 0" });
            return;
          }
          setNotice({
            tone: "confirm",
            message: `ยืนยันบันทึกแผน ${plot.name}`,
            accept: () => {
              const plotError = savePlot(plot.id, { name: plot.name, areaRai });
              if (plotError) {
                setNotice({ tone: "error", message: plotError });
                return;
              }
              finish(savePlanting(plot.id, { plantingId: current?.id ?? (plot.plantingId || null), varietyId: variety, plantedOn, harvestOn, estKg: nextKg }), "บันทึกแผนแล้ว", () =>
                setEditing(false),
              );
            },
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อแปลง
            <input value={plot.name} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พื้นที่ (ไร่)
            <RequiredMark />
            <input value={area} disabled={!editing} inputMode="decimal" onChange={(event) => setArea(event.target.value)} className={fieldClass} />
            {measured != null && <span className="mt-1 block text-[12px] font-normal">{formatRai(measured)} แก้ตัวเลขนี้ได้ถ้าคำนวณไม่ตรง</span>}
          </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              พันธุ์
              <RequiredMark />
              {editing ? (
                <Select
                  label="พันธุ์"
                  className="mt-1"
                  value={variety}
                  onChange={(next) => setVariety(next as Variety)}
                  options={VARIETIES.map((item) => ({ value: item.id, label: item.name }))}
                />
              ) : (
                <input value={variety ? varietyName(variety) : "—"} disabled className={fieldClass} />
              )}
            </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            วันปลูก
            <RequiredMark />
            <DateField
              label="วันปลูก"
              className="mt-1"
              value={plantedOn}
              disabled={!editing}
              max={harvestOn}
              onChange={(next) => {
                setPlantedOn(next);
                if (harvestOn && next && harvestOn < next) setHarvestOn(next);
              }}
            />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            กำหนดเก็บ
            <RequiredMark />
            <DateField label="กำหนดเก็บ" className="mt-1" value={harvestOn} disabled={!editing} min={plantedOn} onChange={setHarvestOn} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ที่คาด (กก.)
            <input value={estKg} disabled={!editing} inputMode="numeric" onChange={(event) => setEstKg(event.target.value)} className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <CanEdit resource="plantings">
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
          </CanEdit>
          {current && (
            <CanDelete resource="plantings">
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
            </CanDelete>
          )}
          {!locked && (
            <CanDelete resource="plots">
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
            </CanDelete>
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
