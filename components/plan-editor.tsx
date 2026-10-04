"use client";

import { useEffect, useState } from "react";
import { Pencil, Save, Trash2, Undo2, X } from "lucide-react";
import { CanDelete, CanEdit } from "@/components/can";
import { useMill } from "@/components/store";
import { ConfirmAlert, DateField, Glyph, PrimaryButton, ResultAlert, SecondaryButton, Select, inputClass } from "@/components/ui";
import {
  VARIETIES,
  currentActivityStage,
  formatRai,
  formatThaiDate,
  latestActivityOfType,
  plantingAreaSummary,
  varietyName,
  type PlantActualPayload,
  type SeedReceivePayload,
  type Variety,
} from "@/lib/mill";

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

export function PlanEditor({
  plot,
  onClose,
  embedded = false,
}: {
  plot: PlanRow;
  onClose: () => void;
  /** When true, parent already shows title / back — skip the duplicate bar. */
  embedded?: boolean;
}) {
  const { plantings, activities, savePlot, savePlanting, saveActivity, removePlot, removePlanting } = useMill();
  const measured = plot.areaRai;
  const current = plantings.find((item) => item.id === plot.plantingId && !item.delivered) ?? null;
  const plantingId = current?.id ?? (plot.plantingId || "");
  const locked = plantings.some((item) => item.plotId === plot.id && item.delivered);
  const fresh = !plot.plantingId;
  const seedActivity = plantingId ? latestActivityOfType(activities, plantingId, "seed_receive") : null;
  const plantActivity = plantingId ? latestActivityOfType(activities, plantingId, "plant_actual") : null;
  const seedPayload = (seedActivity?.payload ?? null) as SeedReceivePayload | null;
  const plantPayload = (plantActivity?.payload ?? null) as PlantActualPayload | null;

  const [editing, setEditing] = useState(fresh);
  const [area, setArea] = useState(String(plot.areaRai));
  const [variety, setVariety] = useState<Variety | "">(plot.varietyId ?? "");
  const [seedReceivedOn, setSeedReceivedOn] = useState(seedActivity?.occurredOn ?? "");
  const [seedQtyKg, setSeedQtyKg] = useState(seedPayload ? kgField(seedPayload.quantityKg) : "");
  const [plantedOn, setPlantedOn] = useState(plantActivity?.occurredOn || current?.plantedOn || plot.plantedOn);
  const [plantedAreaRai, setPlantedAreaRai] = useState(plantPayload ? String(plantPayload.plantedAreaRai) : "");
  const [harvestOn, setHarvestOn] = useState(current?.harvestOn ?? plot.harvestOn);
  const [estKg, setEstKg] = useState(kgField(fresh ? 0 : (current?.estKg ?? plot.estKg)));
  const [notice, setNotice] = useState<null | { tone: "confirm"; message: string; accept: () => void | Promise<void> } | { tone: "success" | "error"; message: string; done?: () => void }>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const savedKg = kgField(plot.plantingId ? (current?.estKg ?? plot.estKg) : 0);
  const savedSeedQty = seedPayload ? kgField(seedPayload.quantityKg) : "";
  const savedPlantedArea = plantPayload ? String(plantPayload.plantedAreaRai) : "";
  const savedPlantedOn = plantActivity?.occurredOn || current?.plantedOn || plot.plantedOn;
  const summary = plantingId
    ? plantingAreaSummary(Number(area) || plot.areaRai, activities, plantingId)
    : { plantedAreaRai: 0, unplantedAreaRai: Number(area) || plot.areaRai, actuallyPlantedOn: null as string | null };
  const stage = plantingId ? currentActivityStage(activities, plantingId) : "ยังไม่มีกิจกรรม";

  const dirty =
    area !== String(plot.areaRai) ||
    variety !== (plot.varietyId ?? "") ||
    seedReceivedOn !== (seedActivity?.occurredOn ?? "") ||
    seedQtyKg !== savedSeedQty ||
    plantedOn !== savedPlantedOn ||
    plantedAreaRai !== savedPlantedArea ||
    harvestOn !== (current?.harvestOn ?? plot.harvestOn) ||
    estKg !== savedKg;

  useEffect(() => {
    setEditing(!plot.plantingId);
    setArea(String(plot.areaRai));
    setVariety(plot.varietyId ?? "");
    setSeedReceivedOn(seedActivity?.occurredOn ?? "");
    setSeedQtyKg(seedPayload ? kgField(seedPayload.quantityKg) : "");
    setPlantedOn(plantActivity?.occurredOn || current?.plantedOn || plot.plantedOn);
    setPlantedAreaRai(plantPayload ? String(plantPayload.plantedAreaRai) : "");
    setHarvestOn(current?.harvestOn ?? plot.harvestOn);
    setEstKg(kgField(plot.plantingId ? (current?.estKg ?? plot.estKg) : 0));
  }, [
    plot.id,
    plot.plantingId,
    plot.areaRai,
    plot.varietyId,
    plot.plantedOn,
    plot.harvestOn,
    plot.estKg,
    current?.plantedOn,
    current?.harvestOn,
    current?.estKg,
    seedActivity?.id,
    seedActivity?.occurredOn,
    seedPayload?.quantityKg,
    plantActivity?.id,
    plantActivity?.occurredOn,
    plantPayload?.plantedAreaRai,
  ]);

  function undo() {
    setArea(String(plot.areaRai));
    setVariety(plot.varietyId ?? "");
    setSeedReceivedOn(seedActivity?.occurredOn ?? "");
    setSeedQtyKg(savedSeedQty);
    setPlantedOn(savedPlantedOn);
    setPlantedAreaRai(savedPlantedArea);
    setHarvestOn(current?.harvestOn ?? plot.harvestOn);
    setEstKg(savedKg);
    if (!dirty) setEditing(false);
  }

  async function finish(error: Promise<string | null> | string | null, success: string, done?: () => void) {
    const message = await error;
    setNotice(message ? { tone: "error", message } : { tone: "success", message: success, done });
  }

  return (
    <div className="border-t border-frame bg-white">
      {!embedded && (
        <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
          <div className="text-[16px] font-bold">แผนรอบ · {plot.name}</div>
          <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold text-bar">
            <X size={14} strokeWidth={1.75} aria-hidden />
            ปิด
          </button>
        </div>
      )}
      <form
        className="px-6 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
          const areaRai = Number(area.trim());
          const trimmedKg = estKg.trim();
          const nextKg = trimmedKg === "" ? 0 : Number(trimmedKg);
          const seedQty = seedQtyKg.trim() === "" ? 0 : Number(seedQtyKg.trim());
          const plantedArea = plantedAreaRai.trim() === "" ? 0 : Number(plantedAreaRai.trim());
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
          if (seedReceivedOn || seedQtyKg.trim()) {
            if (!seedReceivedOn) {
              setNotice({ tone: "error", message: "กรอกวันที่รับเมล็ด" });
              return;
            }
            if (seedQtyKg.trim() === "" || !(seedQty >= 0)) {
              setNotice({ tone: "error", message: "กรอกปริมาณเมล็ด" });
              return;
            }
          }
          if (plantedAreaRai.trim()) {
            if (!(plantedArea > 0)) {
              setNotice({ tone: "error", message: "พื้นที่ปลูกจริงต้องมากกว่า 0" });
              return;
            }
            if (plantedArea > areaRai) {
              setNotice({ tone: "error", message: "พื้นที่ปลูกจริงต้องไม่เกินพื้นที่แปลง" });
              return;
            }
          }
          setNotice({
            tone: "confirm",
            message: `ยืนยันบันทึกแผน ${plot.name}`,
            accept: async () => {
              const plotError = await savePlot(plot.id, { name: plot.name, areaRai });
              if (plotError) {
                setNotice({ tone: "error", message: plotError });
                return;
              }
              const saved = await savePlanting(plot.id, {
                plantingId: current?.id ?? (plot.plantingId || null),
                varietyId: variety,
                plantedOn,
                harvestOn,
                estKg: nextKg,
              });
              if (saved.error || !saved.plantingId) {
                setNotice({ tone: "error", message: saved.error ?? "บันทึกแผนไม่สำเร็จ" });
                return;
              }
              if (seedReceivedOn && seedQtyKg.trim() !== "") {
                const seedError = await saveActivity({
                  id: seedActivity?.id ?? null,
                  plantingId: saved.plantingId,
                  type: "seed_receive",
                  occurredOn: seedReceivedOn,
                  payload: { varietyId: variety, quantityKg: seedQty, intendedAreaRai: areaRai },
                });
                if (seedError) {
                  setNotice({ tone: "error", message: seedError });
                  return;
                }
              }
              if (plantedArea > 0) {
                const plantError = await saveActivity({
                  id: plantActivity?.id ?? null,
                  plantingId: saved.plantingId,
                  type: "plant_actual",
                  occurredOn: plantedOn,
                  payload: { plantedAreaRai: plantedArea },
                });
                if (plantError) {
                  setNotice({ tone: "error", message: plantError });
                  return;
                }
              }
              setNotice({ tone: "success", message: "บันทึกแผนแล้ว", done: () => setEditing(false) });
            },
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block text-[14px] font-bold leading-[1.4]">
            ปลูกจริงแล้ว
            <input value={formatRai(summary.plantedAreaRai)} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ยังไม่ปลูก
            <input value={formatRai(summary.unplantedAreaRai)} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ขั้นตอนปัจจุบัน
            <input value={stage} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อแปลง
            <input value={plot.name} disabled className={fieldClass} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            พื้นที่แปลง (ไร่)
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
                value={variety === "" ? "" : String(variety)}
                onChange={(next) => setVariety(next ? (Number(next) as Variety) : "")}
                options={VARIETIES.map((item) => ({ value: String(item.id), label: item.name }))}
              />
            ) : (
              <input value={variety ? varietyName(variety) : "—"} disabled className={fieldClass} />
            )}
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            วันที่รับเมล็ด
            <DateField label="วันที่รับเมล็ด" className="mt-1" value={seedReceivedOn} disabled={!editing} onChange={setSeedReceivedOn} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ปริมาณเมล็ด (กก.)
            <input value={seedQtyKg} disabled={!editing} inputMode="decimal" onChange={(event) => setSeedQtyKg(event.target.value)} className={fieldClass} />
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
            พื้นที่ปลูกจริง (ไร่)
            <input
              value={plantedAreaRai}
              disabled={!editing}
              inputMode="decimal"
              onChange={(event) => setPlantedAreaRai(event.target.value)}
              className={fieldClass}
            />
            <span className="mt-1 block text-[12px] font-normal text-ink/60">
              ยังไม่ปลูก = พื้นที่แปลง − ปลูกจริง
            </span>
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            กำหนดเก็บ
            <RequiredMark />
            <DateField label="กำหนดเก็บ" className="mt-1" value={harvestOn} disabled={!editing} min={plantedOn} onChange={setHarvestOn} />
          </label>
          <label className="block text-[14px] font-bold leading-[1.4]">
            ที่คาดรับเข้า (กก.)
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
                    accept: async () => finish(removePlanting(current.id), "ลบแผนแล้ว", onClose),
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
                    accept: async () => finish(removePlot(plot.id), "ลบแปลงแล้ว", onClose),
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
