"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import { CanAdd } from "@/components/can";
import { PlotDialog } from "@/components/groups-screen";
import { PlotDetail } from "@/components/plot-detail";
import { useMill } from "@/components/store";
import { api } from "@/lib/api";
import { useServerPage } from "@/components/server-page";
import { defaultVarietyId, type Plot } from "@/lib/mill";
import { placeLabel } from "@/lib/thai-place";
import {
  Dialog,
  FarmerSelect,
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  SearchSelect,
  SecondaryButton,
  SortableTh,
  StatusTab,
  TableScroll,
  inputClass,
  openRow,
  orderBy,
  rowTone,
  tableClass,
  usePagination,
  useTableSort,
} from "@/components/ui";

function RequiredMark() {
  return <span className="text-danger"> *</span>;
}

export function PlotManageScreen() {
  const { varieties, groups, addPlot, revision, plotPage } = useMill();
  const router = useRouter();
  const requestedId = useSearchParams().get("plot");
  const requested = requestedId;
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
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const selected = selectedPlot;
  const listingSort = useTableSort(`${name}:${farmerId}:${groupId}`);
  const page = useServerPage(
    `${name}:${farmerId}:${groupId}:${revision}`,
    (pageNo, pageSize) =>
      api.listPlotsPage({
        q: name,
        farmerId: farmerId || undefined,
        groupId: groupId || undefined,
        page: pageNo,
        pageSize,
      }),
    name === "" && farmerId === "" && groupId === "" ? plotPage : null,
  );

  useEffect(() => {
    if (!selectedId) {
      setSelectedPlot(null);
      return;
    }
    let alive = true;
    void api.getPlot(selectedId).then((plot) => {
      if (alive) setSelectedPlot(plot);
    });
    return () => {
      alive = false;
    };
  }, [selectedId, revision]);

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
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-[14px] font-bold leading-[1.4]">
              เจ้าของแปลง
              <div className="mt-1">
                <FarmerSelect allowAll value={draftFarmer} onChange={setDraftFarmer} />
              </div>
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
              <PrimaryButton
                type="button"
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
              </PrimaryButton>
            </div>
          </form>
        </div>
      )}
      <div className={`overflow-hidden border border-frame ${tab === "listing" ? "rounded-[8px]" : "rounded-b-[8px] rounded-tr-[8px]"}`}>
        {tab === "listing" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
              รายการแปลง
              <span className="text-[14px] font-normal">{page.total} แปลง</span>
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
                    return (
                      <tr key={plot.id} onClick={(event) => openRow(event, () => openPlot(plot.id))} className={rowTone(index)}>
                        <td className="px-5 py-3 font-bold">{plot.name}</td>
                        <td className="px-5 py-3">{plot.ownerName || "—"}</td>
                        <td className="px-5 py-3">{plot.groupName || "ไม่มีกลุ่ม"}</td>
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
            <div className="flex flex-wrap gap-5 px-6 py-4">
              <CanAdd resource="plots">
                <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
                  <Glyph icon={Plus} />
                  เพิ่มแปลง
                </SecondaryButton>
              </CanAdd>
            </div>
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
              <div className="mt-1">
                <FarmerSelect value={pickedOwner} onChange={setPickedOwner} />
              </div>
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
              varietyId: defaultVarietyId(varieties),
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
