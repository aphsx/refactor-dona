"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { CanAdd, CanDelete, CanEdit, CanRead } from "@/components/can";
import { useMill } from "@/components/store";
import {
  ConfirmAlert,
  DateField,
  Dialog,
  Glyph,
  PrimaryButton,
  ResultAlert,
  SecondaryButton,
  Select,
  TableScroll,
  inputClass,
  tableClass,
} from "@/components/ui";
import {
  ACTIVITY_TYPES,
  VARIETIES,
  activitiesOf,
  activitySummary,
  activityTypeLabel,
  currentActivityStage,
  formatRai,
  formatThaiDate,
  nextActivityRound,
  plantingAreaSummary,
  varietyName,
  type ChemicalPayload,
  type FertilizerApplyPayload,
  type FertilizerReceivePayload,
  type PlantActualPayload,
  type PlotActivity,
  type PlotActivityPayload,
  type PlotActivityType,
  type ProblemPayload,
  type SeedReceivePayload,
  type Variety,
} from "@/lib/mill";

type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string; done?: () => void };

function NoticeBox({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  if (!notice) return null;
  if (notice.tone === "confirm") {
    return <ConfirmAlert message={notice.message} onCancel={onDismiss} onConfirm={notice.accept} />;
  }
  return (
    <ResultAlert
      kind={notice.tone}
      message={notice.message}
      onClose={() => {
        if (notice.done) notice.done();
        else onDismiss();
      }}
    />
  );
}

function RequiredMark() {
  return <span className="text-danger"> *</span>;
}

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Timeline + summary for one open planting — embed under แผนการปลูก. */
export function PlantingActivityPanel({
  plotAreaRai,
  plantingId,
  varietyId,
}: {
  plotAreaRai: number;
  plantingId: string;
  varietyId: Variety;
}) {
  const { activities, saveActivity, removeActivity } = useMill();
  const rows = activitiesOf(activities, plantingId);
  const summary = plantingAreaSummary(plotAreaRai, activities, plantingId);
  const stage = currentActivityStage(activities, plantingId);
  const [editor, setEditor] = useState<null | { mode: "create" | "edit"; activity?: PlotActivity; type?: PlotActivityType }>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const hasSeed = rows.some((item) => item.type === "seed_receive");

  return (
    <CanRead resource="activities">
    <div className="border-t border-frame">
      <div className="border-b border-frame bg-sub px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-bold">Timeline กิจกรรม</div>
            <div className="mt-1 text-[14px] text-ink/70">
              พันธุ์ {varietyName(varietyId)} · พื้นที่แปลง {formatRai(plotAreaRai)}
            </div>
          </div>
          <CanAdd resource="activities">
            <PrimaryButton
              className="h-9"
              onClick={() => setEditor({ mode: "create", type: hasSeed ? "plant_actual" : "seed_receive" })}
            >
              <Glyph icon={Plus} />
              เพิ่มกิจกรรม
            </PrimaryButton>
          </CanAdd>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label="พื้นที่ตั้งใจปลูก" value={formatRai(summary.intendedAreaRai)} />
          <SummaryStat label="ปลูกจริงแล้ว" value={formatRai(summary.plantedAreaRai)} emphasize />
          <SummaryStat label="ยังไม่ปลูก" value={formatRai(summary.unplantedAreaRai)} />
          <SummaryStat label="ขั้นตอนปัจจุบัน" value={stage} emphasize />
        </div>
        {summary.actuallyPlantedOn && (
          <div className="mt-2 text-[13px] text-ink/60">วันที่ปลูกจริงล่าสุด {formatThaiDate(summary.actuallyPlantedOn)}</div>
        )}
      </div>

      <TableScroll>
        <table className={tableClass}>
          <thead className="bg-table">
            <tr>
              <th className="border-r border-white px-5 py-3 font-bold">วันที่</th>
              <th className="border-r border-white px-5 py-3 font-bold">กิจกรรม</th>
              <th className="border-r border-white px-5 py-3 font-bold">รายละเอียด</th>
              <th className="px-5 py-3 font-bold" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-ink/60">
                  ยังไม่มีกิจกรรม — เริ่มจากรับเมล็ดพันธุ์หรือปลูกจริง
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3">{formatThaiDate(row.occurredOn)}</td>
                <td className="px-5 py-3 font-bold">{activityTypeLabel(row.type)}</td>
                <td className="max-w-[28rem] truncate px-5 py-3" title={activitySummary(row)}>
                  {activitySummary(row)}
                  {row.note ? ` · ${row.note}` : ""}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <CanEdit resource="activities">
                      <SecondaryButton className="h-9" onClick={() => setEditor({ mode: "edit", activity: row })}>
                        <Glyph icon={Pencil} />
                        แก้ไข
                      </SecondaryButton>
                    </CanEdit>
                    <CanDelete resource="activities">
                      <SecondaryButton
                        className="h-9"
                        onClick={() =>
                          setNotice({
                            tone: "confirm",
                            message: `ยืนยันลบ${activityTypeLabel(row.type)} วันที่ ${formatThaiDate(row.occurredOn)}`,
                            accept: async () => {
                              const message = await removeActivity(row.id);
                              setNotice(message ? { tone: "error", message } : { tone: "success", message: "ลบกิจกรรมแล้ว" });
                            },
                          })
                        }
                      >
                        <Glyph icon={Trash2} />
                        ลบ
                      </SecondaryButton>
                    </CanDelete>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      {editor && (
        <ActivityDialog
          plantingId={plantingId}
          plotAreaRai={plotAreaRai}
          varietyId={varietyId}
          activities={rows}
          mode={editor.mode}
          initialType={editor.type}
          activity={editor.activity}
          onClose={() => setEditor(null)}
          onSave={async (input) => {
            const message = await saveActivity(input);
            if (message) {
              setNotice({ tone: "error", message });
              return message;
            }
            setEditor(null);
            setNotice({ tone: "success", message: editor.mode === "edit" ? "แก้ไขกิจกรรมแล้ว" : "บันทึกกิจกรรมแล้ว" });
            return null;
          }}
        />
      )}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
    </CanRead>
  );
}

function SummaryStat({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-[8px] border border-frame bg-white px-4 py-3">
      <div className="text-[12px] text-ink/60">{label}</div>
      <div className={`mt-1 text-[16px] ${emphasize ? "font-bold text-brand" : "font-bold"}`}>{value}</div>
    </div>
  );
}

function ActivityDialog({
  plantingId,
  plotAreaRai,
  varietyId,
  activities,
  mode,
  initialType,
  activity,
  onClose,
  onSave,
}: {
  plantingId: string;
  plotAreaRai: number;
  varietyId: Variety;
  activities: PlotActivity[];
  mode: "create" | "edit";
  initialType?: PlotActivityType;
  activity?: PlotActivity;
  onClose: () => void;
  onSave: (input: {
    id?: string | null;
    plantingId: string;
    type: PlotActivityType;
    occurredOn: string;
    payload: PlotActivityPayload;
    note?: string;
  }) => Promise<string | null>;
}) {
  const summary = plantingAreaSummary(plotAreaRai, activities, plantingId);
  const [type, setType] = useState<PlotActivityType>(activity?.type ?? initialType ?? "seed_receive");
  const [occurredOn, setOccurredOn] = useState(activity?.occurredOn ?? todayISO());
  const [note, setNote] = useState(activity?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const seed = (activity?.type === "seed_receive" ? activity.payload : null) as SeedReceivePayload | null;
  const plant = (activity?.type === "plant_actual" ? activity.payload : null) as PlantActualPayload | null;
  const fertRecv = (activity?.type === "fertilizer_receive" ? activity.payload : null) as FertilizerReceivePayload | null;
  const fertApply = (activity?.type === "fertilizer_apply" ? activity.payload : null) as FertilizerApplyPayload | null;
  const chemical = (activity?.type === "chemical" ? activity.payload : null) as ChemicalPayload | null;
  const problem = (activity?.type === "problem" ? activity.payload : null) as ProblemPayload | null;

  const [variety, setVariety] = useState<Variety | "">(seed ? (seed.varietyId as Variety) : varietyId);
  const [quantityKg, setQuantityKg] = useState(seed ? String(seed.quantityKg) : "");
  const [intendedAreaRai, setIntendedAreaRai] = useState(
    seed ? String(seed.intendedAreaRai) : String(summary.intendedAreaRai || plotAreaRai),
  );
  const [plantedAreaRai, setPlantedAreaRai] = useState(
    plant ? String(plant.plantedAreaRai) : summary.plantedAreaRai > 0 ? String(summary.plantedAreaRai) : "",
  );
  const [product, setProduct] = useState(fertRecv?.product ?? "");
  const [fertQty, setFertQty] = useState(fertRecv ? String(fertRecv.quantityKg) : "");
  const [fertRound, setFertRound] = useState(
    fertApply ? String(fertApply.round) : String(nextActivityRound(activities, plantingId, "fertilizer_apply")),
  );
  const [brand, setBrand] = useState(fertApply?.brand ?? "");
  const [rateKgPerRai, setRateKgPerRai] = useState(fertApply ? String(fertApply.rateKgPerRai) : "");
  const [chemRound, setChemRound] = useState(
    chemical ? String(chemical.round) : String(nextActivityRound(activities, plantingId, "chemical")),
  );
  const [chemName, setChemName] = useState(chemical?.name ?? "");
  const [chemDetails, setChemDetails] = useState(chemical?.details ?? "");
  const [problemDetails, setProblemDetails] = useState(problem?.details ?? "");

  const softWarning = useMemo(() => {
    if (type === "plant_actual" && !activities.some((item) => item.type === "seed_receive") && mode === "create") {
      return "ยังไม่มีการรับเมล็ดพันธุ์ในรอบนี้ — บันทึกได้ แต่ควรใส่รับเมล็ดย้อนหลังด้วย";
    }
    return "";
  }, [type, activities, mode]);

  function buildPayload(): { payload: PlotActivityPayload; error?: string } {
    if (!occurredOn) return { payload: { details: "" }, error: "ระบุวันที่" };
    if (type === "seed_receive") {
      if (!variety) return { payload: { varietyId: 1, quantityKg: 0, intendedAreaRai: 0 }, error: "เลือกพันธุ์" };
      const qty = Number(quantityKg);
      const area = Number(intendedAreaRai);
      if (!(qty >= 0)) return { payload: { varietyId: variety, quantityKg: 0, intendedAreaRai: 0 }, error: "ปริมาณต้องไม่ติดลบ" };
      if (!(area > 0)) return { payload: { varietyId: variety, quantityKg: qty, intendedAreaRai: 0 }, error: "พื้นที่ตั้งใจต้องมากกว่า 0" };
      if (area > plotAreaRai) {
        return { payload: { varietyId: variety, quantityKg: qty, intendedAreaRai: area }, error: "พื้นที่ตั้งใจต้องไม่เกินพื้นที่แปลง" };
      }
      return { payload: { varietyId: variety, quantityKg: qty, intendedAreaRai: area } };
    }
    if (type === "plant_actual") {
      const area = Number(plantedAreaRai);
      if (!(area > 0)) return { payload: { plantedAreaRai: 0 }, error: "พื้นที่ปลูกจริงต้องมากกว่า 0" };
      if (area > summary.intendedAreaRai) {
        return { payload: { plantedAreaRai: area }, error: "พื้นที่ปลูกจริงต้องไม่เกินพื้นที่ตั้งใจปลูก" };
      }
      return { payload: { plantedAreaRai: area } };
    }
    if (type === "fertilizer_receive") {
      const qty = Number(fertQty);
      if (!product.trim()) return { payload: { product: "", quantityKg: 0 }, error: "ระบุปุ๋ยที่ได้รับ" };
      if (!(qty >= 0)) return { payload: { product: product.trim(), quantityKg: 0 }, error: "ปริมาณต้องไม่ติดลบ" };
      return { payload: { product: product.trim(), quantityKg: qty } };
    }
    if (type === "fertilizer_apply") {
      const round = Number(fertRound);
      const rate = Number(rateKgPerRai);
      if (!(round > 0)) return { payload: { round: 0, brand: "", rateKgPerRai: 0 }, error: "ครั้งที่ต้องมากกว่า 0" };
      if (!brand.trim()) return { payload: { round, brand: "", rateKgPerRai: 0 }, error: "ระบุยี่ห้อ/สูตร" };
      if (!(rate >= 0)) return { payload: { round, brand: brand.trim(), rateKgPerRai: 0 }, error: "ปริมาณ กก./ไร่ ต้องไม่ติดลบ" };
      return { payload: { round, brand: brand.trim(), rateKgPerRai: rate } };
    }
    if (type === "chemical") {
      const round = Number(chemRound);
      if (!(round > 0)) return { payload: { round: 0, name: "", details: "" }, error: "ครั้งที่ต้องมากกว่า 0" };
      if (!chemName.trim()) return { payload: { round, name: "", details: "" }, error: "ระบุชื่อสารเคมี" };
      if (!chemDetails.trim()) return { payload: { round, name: chemName.trim(), details: "" }, error: "ระบุรายละเอียดการใช้" };
      return { payload: { round, name: chemName.trim(), details: chemDetails.trim() } };
    }
    if (!problemDetails.trim()) return { payload: { details: "" }, error: "ระบุรายละเอียดปัญหา" };
    return { payload: { details: problemDetails.trim() } };
  }

  return (
    <Dialog title={mode === "edit" ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const built = buildPayload();
          if (built.error) {
            setError(built.error);
            return;
          }
          setSaving(true);
          void (async () => {
            const message = await onSave({
              id: activity?.id ?? null,
              plantingId,
              type,
              occurredOn,
              payload: built.payload,
              note: type === "problem" ? note.trim() : note.trim(),
            });
            setSaving(false);
            if (message) setError(message);
          })();
        }}
      >
        <label className="block text-[14px] font-bold">
          ประเภทกิจกรรม
          <RequiredMark />
          <Select
            label="ประเภทกิจกรรม"
            value={type}
            disabled={mode === "edit"}
            onChange={(value) => setType(value as PlotActivityType)}
            className="mt-1"
            options={ACTIVITY_TYPES.map((item) => ({ value: item.id, label: item.label }))}
          />
        </label>

        <label className="block text-[14px] font-bold">
          วันที่
          <RequiredMark />
          <DateField label="วันที่" className="mt-1" value={occurredOn} onChange={setOccurredOn} />
        </label>

        {type === "seed_receive" && (
          <>
            <label className="block text-[14px] font-bold">
              พันธุ์ข้าว
              <RequiredMark />
              <Select
                label="พันธุ์ข้าว"
                value={variety === "" ? "" : String(variety)}
                onChange={(value) => setVariety(Number(value) as Variety)}
                className="mt-1"
                options={VARIETIES.map((item) => ({ value: String(item.id), label: item.name }))}
              />
            </label>
            <label className="block text-[14px] font-bold">
              ปริมาณที่นำไป (กก.)
              <RequiredMark />
              <input value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} className={`${inputClass} mt-1`} inputMode="decimal" />
            </label>
            <label className="block text-[14px] font-bold">
              พื้นที่ที่ตั้งใจจะปลูก (ไร่)
              <RequiredMark />
              <input
                value={intendedAreaRai}
                onChange={(event) => setIntendedAreaRai(event.target.value)}
                className={`${inputClass} mt-1`}
                inputMode="decimal"
              />
              <div className="mt-1 text-[12px] font-normal text-ink/60">ไม่เกินพื้นที่แปลง {formatRai(plotAreaRai)}</div>
            </label>
          </>
        )}

        {type === "plant_actual" && (
          <label className="block text-[14px] font-bold">
            พื้นที่ที่ปลูกจริง (ไร่)
            <RequiredMark />
            <input value={plantedAreaRai} onChange={(event) => setPlantedAreaRai(event.target.value)} className={`${inputClass} mt-1`} inputMode="decimal" />
            <div className="mt-1 text-[12px] font-normal text-ink/60">
              พื้นที่ตั้งใจ {formatRai(summary.intendedAreaRai)} · ยังไม่ปลูกจะคำนวณอัตโนมัติ
            </div>
          </label>
        )}

        {type === "fertilizer_receive" && (
          <>
            <label className="block text-[14px] font-bold">
              ปุ๋ยที่ได้รับ
              <RequiredMark />
              <input value={product} onChange={(event) => setProduct(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[14px] font-bold">
              ปริมาณ (กก.)
              <RequiredMark />
              <input value={fertQty} onChange={(event) => setFertQty(event.target.value)} className={`${inputClass} mt-1`} inputMode="decimal" />
            </label>
          </>
        )}

        {type === "fertilizer_apply" && (
          <>
            <label className="block text-[14px] font-bold">
              ครั้งที่
              <RequiredMark />
              <input value={fertRound} onChange={(event) => setFertRound(event.target.value)} className={`${inputClass} mt-1`} inputMode="numeric" />
            </label>
            <label className="block text-[14px] font-bold">
              ยี่ห้อ/สูตร
              <RequiredMark />
              <input value={brand} onChange={(event) => setBrand(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[14px] font-bold">
              ปริมาณ กก./ไร่
              <RequiredMark />
              <input value={rateKgPerRai} onChange={(event) => setRateKgPerRai(event.target.value)} className={`${inputClass} mt-1`} inputMode="decimal" />
            </label>
          </>
        )}

        {type === "chemical" && (
          <>
            <label className="block text-[14px] font-bold">
              ครั้งที่
              <RequiredMark />
              <input value={chemRound} onChange={(event) => setChemRound(event.target.value)} className={`${inputClass} mt-1`} inputMode="numeric" />
            </label>
            <label className="block text-[14px] font-bold">
              ชื่อสารเคมี
              <RequiredMark />
              <input value={chemName} onChange={(event) => setChemName(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[14px] font-bold">
              รายละเอียดการใช้
              <RequiredMark />
              <textarea value={chemDetails} onChange={(event) => setChemDetails(event.target.value)} className={`${inputClass} mt-1 h-24 py-2`} />
            </label>
          </>
        )}

        {type === "problem" && (
          <>
            <label className="block text-[14px] font-bold">
              รายละเอียดของปัญหา
              <RequiredMark />
              <textarea value={problemDetails} onChange={(event) => setProblemDetails(event.target.value)} className={`${inputClass} mt-1 h-24 py-2`} />
            </label>
            <label className="block text-[14px] font-bold">
              หมายเหตุ
              <input value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
          </>
        )}

        {type !== "problem" && (
          <label className="block text-[14px] font-bold">
            หมายเหตุ
            <input value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
        )}

        {softWarning && <p className="text-[13px] text-ink/70">{softWarning}</p>}
        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton type="button" className="h-10" onClick={onClose}>
            <Glyph icon={X} />
            ยกเลิก
          </SecondaryButton>
          <PrimaryButton type="submit" className="h-10" disabled={saving}>
            บันทึก
          </PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
