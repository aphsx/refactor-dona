"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save, Trash2 } from "lucide-react";
import { CanDelete, CanEdit } from "@/components/can";
import { DrawBoundary, PlaceSelects } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { api, measureRingAreaRai } from "@/lib/api";
import { centroid, formatCoord, type Plot } from "@/lib/mill";
import { isCompletePlace, placeAt } from "@/lib/thai-place";
import { ConfirmAlert, DirtyUndoButton, Glyph, PrimaryButton, ResultAlert, SecondaryButton, inputClass } from "@/components/ui";

type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string; done?: () => void };

async function reported(error: Promise<string | null> | string | null, success: string, done?: () => void): Promise<Notice> {
  const message = await error;
  if (message) return { tone: "error", message };
  return { tone: "success", message: success, done };
}

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
        onDismiss();
      }}
    />
  );
}

function RequiredMark() {
  return <span className="text-danger"> *</span>;
}

function parseAmount(value: string) {
  const amount = Number(value.trim());
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export function PlotDetail({
  plot,
  onClose,
  initialEditing = false,
  embedded = false,
}: {
  plot: Plot;
  onClose: () => void;
  initialEditing?: boolean;
  embedded?: boolean;
}) {
  const { savePlot, saveBoundary, removePlot } = useMill();
  const [name, setName] = useState(plot.name);
  const [area, setArea] = useState(String(plot.areaRai));
  const [provinceId, setProvinceId] = useState(plot.provinceId);
  const [districtId, setDistrictId] = useState(plot.districtId);
  const [subdistrictId, setSubdistrictId] = useState(plot.subdistrictId);
  const [boundary, setBoundary] = useState(plot.polygon);
  const [savedBoundary, setSavedBoundary] = useState(plot.polygon);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [editing, setEditing] = useState(initialEditing);
  const [notice, setNotice] = useState<Notice | null>(null);
  const synced = useRef({
    id: plot.id,
    name: plot.name,
    area: String(plot.areaRai),
    provinceId: plot.provinceId,
    districtId: plot.districtId,
    subdistrictId: plot.subdistrictId,
    polygon: plot.polygon,
  });
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const ownerName = plot.ownerName || "—";
  const groupName = plot.groupName || "ไม่มีกลุ่ม";
  const point = boundary.length >= 4 ? centroid(boundary) : null;
  const measured = boundary.length >= 4 ? Number(area) || null : null;
  const drawn = boundary.length >= 4;
  const boundaryChanged = JSON.stringify(boundary) !== JSON.stringify(savedBoundary);
  const dirty =
    name !== plot.name ||
    area !== String(plot.areaRai) ||
    provinceId !== plot.provinceId ||
    districtId !== plot.districtId ||
    subdistrictId !== plot.subdistrictId ||
    boundaryChanged;

  useEffect(() => {
    const prev = synced.current;
    const samePlot = prev.id === plot.id;
    const savedChanged =
      prev.name !== plot.name ||
      prev.area !== String(plot.areaRai) ||
      prev.provinceId !== plot.provinceId ||
      prev.districtId !== plot.districtId ||
      prev.subdistrictId !== plot.subdistrictId ||
      JSON.stringify(prev.polygon) !== JSON.stringify(plot.polygon);
    synced.current = {
      id: plot.id,
      name: plot.name,
      area: String(plot.areaRai),
      provinceId: plot.provinceId,
      districtId: plot.districtId,
      subdistrictId: plot.subdistrictId,
      polygon: plot.polygon,
    };
    if (samePlot && !savedChanged) return;
    setEditing(samePlot ? false : initialEditing);
    setName(plot.name);
    setArea(String(plot.areaRai));
    setProvinceId(plot.provinceId);
    setDistrictId(plot.districtId);
    setSubdistrictId(plot.subdistrictId);
    setBoundary(plot.polygon);
    setSavedBoundary(plot.polygon);
    setPreview(null);
    setDrawing(false);
  }, [plot.id, plot.name, plot.areaRai, plot.provinceId, plot.districtId, plot.subdistrictId, plot.polygon, initialEditing]);

  // List payload is lean — pull the ring when opening detail.
  useEffect(() => {
    if (plot.polygon.length >= 4 || !plot.hasBoundary) return;
    let alive = true;
    void api.getPlot(plot.id).then((full) => {
      if (!alive || full.polygon.length < 4) return;
      setBoundary(full.polygon);
      setSavedBoundary(full.polygon);
    });
    return () => {
      alive = false;
    };
  }, [plot.id, plot.polygon.length, plot.hasBoundary]);

  function undo() {
    if (!dirty) {
      if (embedded) onClose();
      else setEditing(false);
      return;
    }
    setName(plot.name);
    setArea(String(plot.areaRai));
    setProvinceId(plot.provinceId);
    setDistrictId(plot.districtId);
    setSubdistrictId(plot.subdistrictId);
    setBoundary(savedBoundary);
    setPreview(null);
  }

  const showEditor = embedded || editing;

  return (
    <>
      {!embedded && (
        <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
          รายละเอียดแปลง
          <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
            ปิด
          </button>
        </div>
      )}
      <form
        className={`grid min-w-0 gap-4 sm:grid-cols-2 ${embedded ? "whitespace-normal [&>*]:min-w-0 [&_input]:block [&_input]:max-w-full" : "px-6 py-5"}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!showEditor) return;
          const areaRai = parseAmount(area);
          if (!name.trim()) {
            setNotice({ tone: "error", message: "กรอกชื่อแปลง" });
            return;
          }
          if (!Number.isFinite(areaRai) || areaRai <= 0) {
            setNotice({ tone: "error", message: "พื้นที่ต้องมากกว่า 0" });
            return;
          }
          if (!isCompletePlace({ provinceId, districtId, subdistrictId })) {
            setNotice({ tone: "error", message: "กรอกตำบล อำเภอ และจังหวัด" });
            return;
          }
          setNotice({
            tone: "confirm",
            message: `ยืนยันบันทึก ${name.trim()}`,
            accept: async () => {
              const plotError = await savePlot(plot.id, { name, areaRai, provinceId, districtId, subdistrictId });
              if (plotError) {
                setNotice({ tone: "error", message: plotError });
                return;
              }
              const boundaryError = boundaryChanged
                ? await saveBoundary(plot.id, boundary, areaRai, preview)
                : null;
              if (!boundaryError) {
                setPreview(null);
                if (boundaryChanged) setSavedBoundary(boundary);
              }
              setNotice(await reported(boundaryError, "บันทึกแปลงแล้ว", () => (embedded ? onClose() : setEditing(false))));
            },
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อแปลง
          <RequiredMark />
          <input value={name} disabled={!showEditor} onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พื้นที่ (ไร่)
          <RequiredMark />
          <input value={area} disabled={!showEditor} inputMode="decimal" onChange={(event) => setArea(event.target.value)} className={fieldClass} />
          <CanEdit resource="plots">
            <button
              type="button"
              onClick={() => {
                setDraft([]);
                setDrawing(true);
              }}
              className="mt-2 text-[14px] font-bold text-link underline"
            >
              {drawn ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
            </button>
          </CanEdit>
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          เจ้าของแปลง
          <input value={ownerName} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          กลุ่ม
          <input value={groupName} disabled className={fieldClass} />
        </label>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3 [&>*]:min-w-0">
          <PlaceSelects
            provinceId={provinceId}
            districtId={districtId}
            subdistrictId={subdistrictId}
            disabled={!showEditor}
            required
            onChange={(place) => {
              setProvinceId(place.provinceId);
              setDistrictId(place.districtId);
              setSubdistrictId(place.subdistrictId);
            }}
          />
        </div>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พิกัด
          <input value={point ? formatCoord(point) : "ยังไม่มีรูป"} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พื้นที่วัดได้
          <input value={measured == null ? "ยังไม่มีรูป" : `${measured} ไร่`} disabled className={fieldClass} />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <CanEdit resource="plots">
            {showEditor ? (
              <>
                <DirtyUndoButton onClick={undo} dirty={dirty} />
                <PrimaryButton type="submit">
                  <Glyph icon={Save} />
                  บันทึก
                </PrimaryButton>
              </>
            ) : (
              <SecondaryButton type="button" onClick={() => setEditing(true)}>
                <Glyph icon={Pencil} />
                แก้ไข
              </SecondaryButton>
            )}
          </CanEdit>
          {!embedded && (
          <CanDelete resource="plots">
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบแปลง ${plot.name}`,
                  accept: async () => setNotice(await reported(removePlot(plot.id), "ลบแปลงแล้ว", onClose)),
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
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
      {drawing && (
        <DrawBoundary
          title={drawn ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
          plots={[]}
          excludeId={plot.id}
          draft={draft}
          onDraft={setDraft}
          place={{ provinceId, districtId, subdistrictId }}
          onUse={(ring, nextPreview) => {
            void (async () => {
              const nextArea = await measureRingAreaRai(ring);
              if (nextArea == null) return;
              const here = centroid(ring);
              const place = placeAt(here.lng, here.lat);
              setBoundary(ring);
              setPreview(nextPreview);
              setArea(String(nextArea));
              if (place) {
                setProvinceId(place.provinceId);
                setDistrictId(place.districtId);
                setSubdistrictId(place.subdistrictId);
              }
              setEditing(true);
              setDrawing(false);
            })();
          }}
          onClose={() => setDrawing(false)}
        />
      )}
    </>
  );
}
