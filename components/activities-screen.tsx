"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { CanAdd, CanDelete, CanEdit, CanRead } from "@/components/can";
import { useMill } from "@/components/store";
import {
  ConfirmAlert,
  DateField,
  Dialog,
  Glyph,
  Pagination,
  PrimaryButton,
  ResultAlert,
  SecondaryButton,
  TableScroll,
  inputClass,
  tableClass,
  usePagination,
} from "@/components/ui";
import {
  TIMELINE_ACTIVITY_TYPES,
  activitySummary,
  activityTypeLabel,
  activitiesOf,
  formatThaiDate,
  latestActivityOfType,
  nextActivityRound,
  type ChemicalPayload,
  type FertilizerApplyPayload,
  type FertilizerReceivePayload,
  type PlotActivity,
  type PlotActivityPayload,
  type PlotActivityType,
  type ProblemPayload,
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
  plantedOn = "",
}: {
  plotAreaRai: number;
  plantingId: string;
  varietyId: Variety;
  /** From แผนรอบ — auto-creates ปลูกจริง on the timeline when missing. */
  plantedOn?: string;
}) {
  const { activities, saveActivity, removeActivity } = useMill();
  const rows = activitiesOf(activities, plantingId);
  const page = usePagination(rows, plantingId);
  const [editor, setEditor] = useState<null | { mode: "create" | "edit"; activity?: PlotActivity; type?: PlotActivityType }>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const syncingPlant = useRef(false);
  const hasPlantActual = Boolean(latestActivityOfType(activities, plantingId, "plant_actual"));

  // Pull วันปลูก from the plan above onto Timeline as ปลูกจริง (once).
  useEffect(() => {
    if (!plantingId || !plantedOn || hasPlantActual || syncingPlant.current) return;
    syncingPlant.current = true;
    void saveActivity({
      plantingId,
      type: "plant_actual",
      occurredOn: plantedOn,
      payload: { plantedAreaRai: plotAreaRai > 0 ? plotAreaRai : 0.01 },
    }).finally(() => {
      syncingPlant.current = false;
    });
  }, [plantingId, plantedOn, plotAreaRai, hasPlantActual, saveActivity]);

  return (
    <CanRead resource="activities">
    <div className="border-t border-frame">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-white">
        <div className="text-[16px] font-bold">Timeline กิจกรรม</div>
        <CanAdd resource="activities">
          <div className="flex flex-wrap gap-2">
            {TIMELINE_ACTIVITY_TYPES.map((item) => (
              <SecondaryButton
                key={item.id}
                className="h-9"
                onClick={() => setEditor({ mode: "create", type: item.id })}
              >
                <Glyph icon={Plus} />
                {item.shortLabel}
              </SecondaryButton>
            ))}
          </div>
        </CanAdd>
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
                  ยังไม่มีกิจกรรม
                </td>
              </tr>
            )}
            {page.rows.map((row, index) => (
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
      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        onPageChange={page.setPage}
        onPageSizeChange={page.setPageSize}
      />

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
  const type = activity?.type ?? initialType ?? "fertilizer_receive";
  const [occurredOn, setOccurredOn] = useState(activity?.occurredOn ?? todayISO());
  const [note, setNote] = useState(activity?.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fertRecv = (activity?.type === "fertilizer_receive" ? activity.payload : null) as FertilizerReceivePayload | null;
  const fertApply = (activity?.type === "fertilizer_apply" ? activity.payload : null) as FertilizerApplyPayload | null;
  const chemical = (activity?.type === "chemical" ? activity.payload : null) as ChemicalPayload | null;
  const problem = (activity?.type === "problem" ? activity.payload : null) as ProblemPayload | null;

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

  function buildPayload(): { payload: PlotActivityPayload; error?: string } {
    if (!occurredOn) return { payload: { details: "" }, error: "ระบุวันที่" };
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
    <Dialog title={mode === "edit" ? `แก้ไข${activityTypeLabel(type)}` : `เพิ่ม${activityTypeLabel(type)}`} onClose={onClose}>
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
              note: note.trim(),
            });
            setSaving(false);
            if (message) setError(message);
          })();
        }}
      >
        <label className="block text-[14px] font-bold">
          วันที่
          <RequiredMark />
          <DateField label="วันที่" className="mt-1" value={occurredOn} onChange={setOccurredOn} />
        </label>

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
