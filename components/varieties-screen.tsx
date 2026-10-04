"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { CanAdd, CanDelete, CanEdit } from "@/components/can";
import { useMill } from "@/components/store";
import {
  ConfirmAlert,
  Dialog,
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  ResultAlert,
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
import type { VarietyItem } from "@/lib/mill";

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
        notice.done?.();
        onDismiss();
      }}
    />
  );
}

async function reported(error: Promise<string | null> | string | null, success: string, done?: () => void): Promise<Notice> {
  const message = await error;
  return message ? { tone: "error", message } : { tone: "success", message: success, done };
}

export function VarietyManageScreen() {
  const { varieties, createVariety } = useMill();
  const router = useRouter();
  const requestedRaw = useSearchParams().get("variety");
  const requestedId = requestedRaw ? Number(requestedRaw) : null;
  const requested = requestedId != null && varieties.some((item) => item.id === requestedId) ? requestedId : null;
  const [tab, setTab] = useState<"listing" | "detail">(requested != null ? "detail" : "listing");
  const [draftName, setDraftName] = useState("");
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(requested);
  const [creating, setCreating] = useState(false);
  const selected = varieties.find((item) => item.id === selectedId) ?? null;

  const rows = useMemo(() => varieties.filter((item) => matchesQuery(name, item.name)), [varieties, name]);
  const listingSort = useTableSort(name);
  const ordered = orderBy(rows, listingSort.sort, (item, key) => {
    if (key === "id") return item.id;
    return item.name;
  });
  const page = usePagination(ordered, name);

  function openVariety(id: number) {
    setSelectedId(id);
    setTab("detail");
    router.replace(`/varieties/manage?variety=${id}`);
  }

  function closeDetail() {
    setSelectedId(null);
    setTab("listing");
    router.replace("/varieties/manage");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการพันธุ์ข้าว" />
      <div className="flex items-end gap-1">
        <StatusTab label="พันธุ์ข้าว" active={tab === "listing"} onClick={closeDetail} />
        {tab === "detail" && selected && <StatusTab label="รายละเอียดพันธุ์" active onClick={() => setTab("detail")} />}
      </div>
      {tab === "listing" && (
        <div className="mb-6 overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาพันธุ์ข้าว</div>
          <form
            className="grid gap-4 px-6 py-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setName(draftName);
            }}
          >
            <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
              ชื่อพันธุ์
              <SuggestInput
                label="ชื่อพันธุ์"
                className="mt-1"
                value={draftName}
                onChange={setDraftName}
                suggestions={[...varieties].sort((a, b) => a.name.localeCompare(b.name, "th")).map((item) => item.name)}
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
                  setName("");
                }}
              >
                <Glyph icon={RotateCcw} />
                ล้าง
              </SecondaryButton>
              <CanAdd resource="varieties">
                <SecondaryButton onClick={() => setCreating(true)}>
                  <Glyph icon={Plus} />
                  เพิ่มพันธุ์
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
              รายการพันธุ์ข้าว
              <span className="text-[14px] font-normal">{varieties.length} พันธุ์</span>
            </div>
            <TableScroll>
              <table className={tableClass}>
                <thead className="bg-table">
                  <tr>
                    <SortableTh label="รหัส" column="id" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                    <SortableTh label="ชื่อพันธุ์" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {page.rows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-6 text-ink/60">
                        ไม่พบพันธุ์ข้าว
                      </td>
                    </tr>
                  )}
                  {page.rows.map((item, index) => (
                    <tr key={item.id} onClick={(event) => openRow(event, () => openVariety(item.id))} className={rowTone(index)}>
                      <td className="px-5 py-3">{item.id}</td>
                      <td className="px-5 py-3 font-bold">{item.name}</td>
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
          </>
        )}
        {tab === "detail" && selected && <VarietyDetail variety={selected} onClose={closeDetail} />}
      </div>
      {creating && <CreateVariety onClose={() => setCreating(false)} onCreate={createVariety} />}
    </div>
  );
}

function VarietyDetail({ variety, onClose }: { variety: VarietyItem; onClose: () => void }) {
  const { updateVariety, removeVariety } = useMill();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(variety.name);
  const [notice, setNotice] = useState<Notice | null>(null);
  const fieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;
  const dirty = draftName !== variety.name;

  useEffect(() => {
    setEditing(false);
    setDraftName(variety.name);
  }, [variety.id, variety.name]);

  function undo() {
    setDraftName(variety.name);
    if (!dirty) setEditing(false);
  }

  return (
    <>
      <div className="flex items-center justify-between bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดพันธุ์
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <form
        className="grid gap-4 px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!editing) return;
          if (!draftName.trim()) {
            setNotice({ tone: "error", message: "กรอกชื่อพันธุ์" });
            return;
          }
          setNotice({
            tone: "confirm",
            message: "ยืนยันบันทึกพันธุ์ข้าว",
            accept: async () =>
              setNotice(await reported(updateVariety(variety.id, draftName), "บันทึกพันธุ์แล้ว", () => setEditing(false))),
          });
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          รหัส
          <input value={String(variety.id)} disabled className={fieldClass} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อพันธุ์
          <input value={draftName} disabled={!editing} onChange={(event) => setDraftName(event.target.value)} className={fieldClass} />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <CanEdit resource="varieties">
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
          <CanDelete resource="varieties">
            <SecondaryButton
              type="button"
              onClick={() =>
                setNotice({
                  tone: "confirm",
                  message: `ยืนยันลบพันธุ์ ${variety.name}`,
                  accept: async () => setNotice(await reported(removeVariety(variety.id), "ลบพันธุ์แล้ว", onClose)),
                })
              }
            >
              <Glyph icon={Trash2} />
              ลบ
            </SecondaryButton>
          </CanDelete>
        </div>
      </form>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}

function CreateVariety({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  return (
    <>
      <Dialog title="เพิ่มพันธุ์ข้าว" onClose={onClose}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setNotice({ tone: "error", message: "กรอกชื่อพันธุ์" });
              return;
            }
            setNotice({
              tone: "confirm",
              message: "ยืนยันเพิ่มพันธุ์ข้าว",
              accept: async () => setNotice(await reported(onCreate(name), "เพิ่มพันธุ์แล้ว", onClose)),
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อพันธุ์
            <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <div className="flex justify-end gap-3">
            <SecondaryButton onClick={onClose}>
              <Glyph icon={X} />
              ยกเลิก
            </SecondaryButton>
            <PrimaryButton type="submit">
              <Glyph icon={Save} />
              บันทึก
            </PrimaryButton>
          </div>
        </form>
      </Dialog>
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
