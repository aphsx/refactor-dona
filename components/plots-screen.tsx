"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { CanAdd, CanDelete, CanEdit } from "@/components/can";
import { PlaceSelects, PlotDialog, DrawBoundary } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { measureRingAreaRai } from "@/lib/api";
import { farmerHandle, farmerName, formatCoord, centroid, type Plot } from "@/lib/mill";
import { isCompletePlace, placeAt, placeLabel } from "@/lib/thai-place";
import {
  ConfirmAlert,
  Dialog,
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  ResultAlert,
  SearchSelect,
  SecondaryButton,
  SortableTh,
  StatusTab,
  SuggestInput,
  TableScroll,
  inputClass,
  matchesQuery,
  openRow,
  orderBy,
  rowTone,
  tableClass,
  usePagination,
  useTableSort,
} from "@/components/ui";

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

export function PlotManageScreen() {
  const { plots, farmers, groups, addPlot } = useMill();
  const router = useRouter();
  const requestedId = useSearchParams().get("plot");
  const requested = plots.some((plot) => plot.id === requestedId) ? requestedId : null;
  const [tab, setTab] = useState<"listing" | "detail">(requested ? "detail" : "listing");
  const [draftName, setDraftName] = useState("");
  const [draftFarmer, setDraftFarmer] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [name, setName] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requested);
  const [adding, setAdding] = useState(false);
  const [pickedOwner, setPickedOwner] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const selected = plots.find((plot) => plot.id === selectedId) ?? null;

  const rows = useMemo(() => {
    return plots.filter((plot) => {
      const owner = farmers.find((farmer) => farmer.id === plot.farmerId);
      if (farmerId && plot.farmerId !== farmerId) return false;
      if (groupId === "none" && owner?.groupId != null) return false;
      if (groupId && groupId !== "none" && owner?.groupId !== groupId) return false;
      const place = placeLabel(plot);
      return matchesQuery(name, `${plot.name} ${owner ? farmerName(owner) : ""} ${place}`);
    });
  }, [plots, farmers, name, farmerId, groupId]);
  const listingSort = useTableSort(`${name}:${farmerId}:${groupId}`);
  const ordered = orderBy(rows, listingSort.sort, (plot, key) => {
    const owner = farmers.find((farmer) => farmer.id === plot.farmerId);
    if (key === "name") return plot.name;
    if (key === "owner") return owner ? farmerName(owner) : "";
    if (key === "group") return groups.find((group) => group.id === owner?.groupId)?.name ?? "";
    if (key === "area") return plot.areaRai;
    return placeLabel(plot);
  });
  const page = usePagination(ordered, `${name}:${farmerId}:${groupId}`);

  function openPlot(id: string) {
    setSelectedId(id);
    setTab("detail");
    router.replace(`/map/manage?plot=${id}`);
  }

  function closeDetail() {
    setSelectedId(null);
    setTab("listing");
    router.replace("/map/manage");
  }

  function closeAdd() {
    setAdding(false);
    setPickedOwner("");
    setOwnerId("");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการแปลง" />
      <div className="flex items-end gap-1">
        <StatusTab label="แปลง" active={tab === "listing"} onClick={closeDetail} />
        {tab === "detail" && selected && <StatusTab label="รายละเอียดแปลง" active onClick={() => setTab("detail")} />}
      </div>
      {tab === "listing" && (
        <div className="mb-6 overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาแปลง</div>
          <form
            className="grid gap-4 px-6 py-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setName(draftName);
              setFarmerId(draftFarmer);
              setGroupId(draftGroup);
            }}
          >
            <label className="block text-[14px] font-bold leading-[1.4]">
              ชื่อแปลง
              <SuggestInput
                label="ชื่อแปลง"
                className="mt-1"
                value={draftName}
                onChange={setDraftName}
                suggestions={[...plots].sort((a, b) => a.name.localeCompare(b.name, "th")).map((plot) => plot.name)}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              เจ้าของแปลง
              <SearchSelect
                label="เจ้าของแปลง"
                className="mt-1"
                value={draftFarmer}
                onChange={setDraftFarmer}
                options={[
                  { value: "", label: "ทั้งหมด" },
                  ...[...farmers]
                    .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"))
                    .map((farmer) => ({ value: farmer.id, label: farmerHandle(farmer) })),
                ]}
              />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              กลุ่ม
              <SearchSelect
                label="กลุ่ม"
                className="mt-1"
                value={draftGroup}
                onChange={setDraftGroup}
                options={[
                  { value: "", label: "ทั้งหมด" },
                  { value: "none", label: "ไม่มีกลุ่ม" },
                  ...[...groups].sort((a, b) => a.name.localeCompare(b.name, "th")).map((group) => ({ value: group.id, label: group.name })),
                ]}
              />
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <PrimaryButton type="submit">
                <Glyph icon={Search} />
                ค้นหา
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  setDraftName("");
                  setDraftFarmer("");
                  setDraftGroup("");
                  setName("");
                  setFarmerId("");
                  setGroupId("");
                }}
              >
                <Glyph icon={RotateCcw} />
                ล้าง
              </SecondaryButton>
              <CanAdd resource="plots">
                <SecondaryButton onClick={() => setAdding(true)}>
                  <Glyph icon={Plus} />
                  เพิ่มแปลง
                </SecondaryButton>
              </CanAdd>
            </div>
          </form>
        </div>
      )}
      <div className={`overflow-hidden border border-frame ${tab === "listing" ? "rounded-[8px]" : "rounded-b-[8px] rounded-tr-[8px]"}`}>
        {tab === "listing" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
              รายการแปลง
              <span className="text-[14px] font-normal">{plots.length} แปลง</span>
            </div>
            <TableScroll>
              <table className={tableClass}>
                <thead className="bg-table">
                  <tr>
                    <SortableTh label="แปลง" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                    <SortableTh label="เจ้าของ" column="owner" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                    <SortableTh label="กลุ่ม" column="group" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                    <SortableTh label="พื้นที่" column="area" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                    <SortableTh label="ที่อยู่แปลง" column="place" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {page.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-ink/60">
                        ไม่พบแปลง
                      </td>
                    </tr>
                  )}
                  {page.rows.map((plot, index) => {
                    const owner = farmers.find((farmer) => farmer.id === plot.farmerId);
                    const group = groups.find((item) => item.id === owner?.groupId);
                    return (
                      <tr key={plot.id} onClick={(event) => openRow(event, () => openPlot(plot.id))} className={rowTone(index)}>
                        <td className="px-5 py-3 font-bold">{plot.name}</td>
                        <td className="px-5 py-3">{owner ? farmerName(owner) : "—"}</td>
                        <td className="px-5 py-3">{group?.name ?? "ไม่มีกลุ่ม"}</td>
                        <td className="px-5 py-3">{plot.areaRai} ไร่</td>
                        <td className="px-5 py-3">{placeLabel(plot)}</td>
                      </tr>
                    );
                  })}
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
          </>
        )}
        {tab === "detail" && selected && <PlotDetail plot={selected} onClose={closeDetail} />}
      </div>
      {adding && !ownerId && (
        <Dialog title="เพิ่มแปลง" onClose={closeAdd}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!pickedOwner) return;
              setOwnerId(pickedOwner);
            }}
          >
            <label className="block text-[14px] font-bold leading-[1.4]">
              เจ้าของแปลง
              <RequiredMark />
              <SearchSelect
                label="เจ้าของแปลง"
                className="mt-1"
                placeholder="เลือกเกษตรกร"
                value={pickedOwner}
                onChange={setPickedOwner}
                options={[...farmers]
                  .sort((a, b) => farmerName(a).localeCompare(farmerName(b), "th"))
                  .map((farmer) => ({ value: farmer.id, label: farmerHandle(farmer) }))}
              />
            </label>
            <div className="flex justify-end gap-3">
              <SecondaryButton onClick={closeAdd}>
                <Glyph icon={X} />
                ยกเลิก
              </SecondaryButton>
              <PrimaryButton type="submit">
                <Glyph icon={Plus} />
                ต่อไป
              </PrimaryButton>
            </div>
          </form>
        </Dialog>
      )}
      {adding && ownerId && (
        <PlotDialog
          title="เพิ่มแปลง"
          name=""
          area=""
          farmerId={ownerId}
          schedule={false}
          onClose={closeAdd}
          onSave={(plotName, areaRai, _variety, place) =>
            addPlot(ownerId, {
              name: plotName,
              areaRai,
              varietyId: 1,
              plantedOn: "",
              harvestOn: "",
              estKg: 0,
              provinceId: place.provinceId,
              districtId: place.districtId,
              subdistrictId: place.subdistrictId,
              polygon: place.polygon,
              preview: place.preview,
            })
          }
        />
      )}
    </div>
  );
}

function PlotDetail({ plot, onClose }: { plot: Plot; onClose: () => void }) {
  const { farmers, groups, plots, savePlot, saveBoundary, removePlot } = useMill();
  const [name, setName] = useState(plot.name);
  const [area, setArea] = useState(String(plot.areaRai));
  const [provinceId, setProvinceId] = useState(plot.provinceId);
  const [districtId, setDistrictId] = useState(plot.districtId);
  const [subdistrictId, setSubdistrictId] = useState(plot.subdistrictId);
  const [boundary, setBoundary] = useState(plot.polygon);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const owner = farmers.find((farmer) => farmer.id === plot.farmerId) ?? null;
  const group = groups.find((item) => item.id === owner?.groupId) ?? null;
  const point = boundary.length >= 4 ? centroid(boundary) : null;
  const measured = boundary.length >= 4 ? Number(area) || null : null;
  const drawn = boundary.length >= 4;
  const boundaryChanged = JSON.stringify(boundary) !== JSON.stringify(plot.polygon);
  const dirty =
    name !== plot.name ||
    area !== String(plot.areaRai) ||
    provinceId !== plot.provinceId ||
    districtId !== plot.districtId ||
    subdistrictId !== plot.subdistrictId ||
    boundaryChanged;

  useEffect(() => {
    setEditing(false);
    setName(plot.name);
    setArea(String(plot.areaRai));
    setProvinceId(plot.provinceId);
    setDistrictId(plot.districtId);
    setSubdistrictId(plot.subdistrictId);
    setBoundary(plot.polygon);
    setPreview(null);
    setDrawing(false);
  }, [plot.id, plot.name, plot.areaRai, plot.provinceId, plot.districtId, plot.subdistrictId, plot.polygon]);

  function undo() {
    setName(plot.name);
    setArea(String(plot.areaRai));
    setProvinceId(plot.provinceId);
    setDistrictId(plot.districtId);
    setSubdistrictId(plot.subdistrictId);
    setBoundary(plot.polygon);
    setPreview(null);
    if (!dirty) setEditing(false);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดแปลง
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <form
        className="grid gap-4 px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
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
              if (!boundaryError) setPreview(null);
              setNotice(await reported(boundaryError, "บันทึกแปลงแล้ว", () => setEditing(false)));
            },
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อแปลง
          <RequiredMark />
          <input value={name} disabled={!editing} onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          พื้นที่ (ไร่)
          <RequiredMark />
          <input value={area} disabled={!editing} inputMode="decimal" onChange={(event) => setArea(event.target.value)} className={fieldClass} />
          <CanEdit resource="plots">
            <button
              type="button"
              onClick={() => {
                setDraft([]);
                setDrawing(true);
              }}
              className="mt-2 text-[14px] font-bold text-brand underline"
            >
              {drawn ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
            </button>
          </CanEdit>
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          เจ้าของแปลง
          <input value={owner ? farmerName(owner) : "—"} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          กลุ่ม
          <input value={group?.name ?? "ไม่มีกลุ่ม"} disabled className={fieldClass} />
        </label>
        <PlaceSelects
          provinceId={provinceId}
          districtId={districtId}
          subdistrictId={subdistrictId}
          disabled={!editing}
          required
          onChange={(place) => {
            setProvinceId(place.provinceId);
            setDistrictId(place.districtId);
            setSubdistrictId(place.subdistrictId);
          }}
        />
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
            {editing ? (
              <>
                <SecondaryButton type="button" onClick={undo}>
                  <Glyph icon={Undo2} />
                  {dirty ? "เลิกทำ" : "ยกเลิก"}
                </SecondaryButton>
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
        </div>
      </form>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
      {drawing && (
        <DrawBoundary
          title={drawn ? "แก้ไขขอบเขต" : "วาดขอบเขต"}
          plots={plots.filter((item) => item.id !== plot.id && item.polygon.length >= 4)}
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