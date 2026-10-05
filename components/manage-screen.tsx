"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { CanAdd, CanDelete, CanEdit } from "@/components/can";
import { useMill } from "@/components/store";
import {
  ConfirmAlert,
  Dialog,
  DirtyUndoButton,
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  ResultAlert,
  SecondaryButton,
  SortableTh,
  SuggestInput,
  TableScroll,
  inputClass,
  matchesQuery,
  orderBy,
  tableClass,
  usePagination,
  useTableSort,
} from "@/components/ui";
import type { ProductKindItem, VarietyItem } from "@/lib/mill";

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

/** Master-data: rice varieties — inline edit/delete, no detail page. */
export function VarietiesManageScreen() {
  const { varieties, createVariety, updateVariety, removeVariety } = useMill();
  const [draftName, setDraftName] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const rows = useMemo(() => varieties.filter((item) => matchesQuery(name, item.name)), [varieties, name]);
  const listingSort = useTableSort(name);
  const ordered = orderBy(rows, listingSort.sort, (item, key) => {
    if (key === "id") return item.id;
    return item.name;
  });
  const page = usePagination(ordered, name);

  function startEdit(item: VarietyItem) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="พันธุ์ข้าว" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
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
            <PrimaryButton
              type="button"
              onClick={() => {
                setDraftName("");
                setName("");
              }}
            >
              <Glyph icon={RotateCcw} />
              ล้าง
            </PrimaryButton>
            <CanAdd resource="varieties">
              <SecondaryButton onClick={() => setCreating(true)}>
                <Glyph icon={Plus} />
                เพิ่มพันธุ์
              </SecondaryButton>
            </CanAdd>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-frame">
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
                <th className="w-0 whitespace-nowrap px-5 py-3 font-bold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-ink/60">
                    ไม่พบพันธุ์ข้าว
                  </td>
                </tr>
              )}
              {page.rows.map((item, index) => {
                const editing = editingId === item.id;
                return (
                  <tr key={item.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                    <td className="px-5 py-3">{item.id}</td>
                    <td className="px-5 py-3">
                      {editing ? (
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className={inputClass}
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold">{item.name}</span>
                      )}
                    </td>
                    <td className="w-0 whitespace-nowrap px-5 py-3">
                      <div className="flex gap-2">
                        <CanEdit resource="varieties">
                          {editing ? (
                            <>
                              <DirtyUndoButton
                                compact
                                dirty={editName !== item.name}
                                onClick={() => {
                                  if (editName !== item.name) setEditName(item.name);
                                  else cancelEdit();
                                }}
                              />
                              <PrimaryButton
                                type="button"
                                compact
                                onClick={() => {
                                  if (!editName.trim()) {
                                    setNotice({ tone: "error", message: "กรอกชื่อพันธุ์" });
                                    return;
                                  }
                                  setNotice({
                                    tone: "confirm",
                                    message: "ยืนยันบันทึกพันธุ์ข้าว",
                                    accept: async () =>
                                      setNotice(
                                        await reported(updateVariety(item.id, editName), "บันทึกพันธุ์แล้ว", cancelEdit),
                                      ),
                                  });
                                }}
                              >
                                <Glyph icon={Save} />
                                บันทึก
                              </PrimaryButton>
                            </>
                          ) : (
                            <SecondaryButton type="button" className="h-9" onClick={() => startEdit(item)}>
                              <Glyph icon={Pencil} />
                              แก้ไข
                            </SecondaryButton>
                          )}
                        </CanEdit>
                        <CanDelete resource="varieties">
                          <SecondaryButton
                            type="button"
                            className="h-9"
                            onClick={() =>
                              setNotice({
                                tone: "confirm",
                                message: `ยืนยันลบพันธุ์ ${item.name}`,
                                accept: async () =>
                                  setNotice(
                                    await reported(removeVariety(item.id), "ลบพันธุ์แล้ว", () => {
                                      if (editingId === item.id) cancelEdit();
                                    }),
                                  ),
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
      </div>

      {creating && <CreateVariety onClose={() => setCreating(false)} onCreate={createVariety} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
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

/** Master-data: product kinds — inline edit/delete, no detail page. */
export function ProductKindsManageScreen() {
  const { productKinds, createProductKind, updateProductKind, removeProductKind } = useMill();
  const [draftName, setDraftName] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const rows = useMemo(() => productKinds.filter((item) => matchesQuery(name, item.name)), [productKinds, name]);
  const listingSort = useTableSort(name);
  const ordered = orderBy(rows, listingSort.sort, (item, key) => {
    if (key === "id") return item.id;
    return item.name;
  });
  const page = usePagination(ordered, name);

  function startEdit(item: ProductKindItem) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="ชนิดสินค้า" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาชนิดสินค้า</div>
        <form
          className="grid gap-4 px-6 py-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setName(draftName);
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
            ชื่อชนิด
            <SuggestInput
              label="ชื่อชนิด"
              className="mt-1"
              value={draftName}
              onChange={setDraftName}
              suggestions={[...productKinds].sort((a, b) => a.name.localeCompare(b.name, "th")).map((item) => item.name)}
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
                setName("");
              }}
            >
              <Glyph icon={RotateCcw} />
              ล้าง
            </PrimaryButton>
            <CanAdd resource="productKinds">
              <SecondaryButton onClick={() => setCreating(true)}>
                <Glyph icon={Plus} />
                เพิ่มชนิด
              </SecondaryButton>
            </CanAdd>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
          รายการชนิดสินค้า
          <span className="text-[14px] font-normal">{productKinds.length} ชนิด</span>
        </div>
        <TableScroll>
          <table className={tableClass}>
            <thead className="bg-table">
              <tr>
                <SortableTh label="รหัส" column="id" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <SortableTh label="ชื่อชนิด" column="name" sort={listingSort.sort} onSort={listingSort.toggleSort} />
                <th className="w-0 whitespace-nowrap px-5 py-3 font-bold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-ink/60">
                    ไม่พบชนิดสินค้า
                  </td>
                </tr>
              )}
              {page.rows.map((item, index) => {
                const editing = editingId === item.id;
                return (
                  <tr key={item.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                    <td className="px-5 py-3">{item.id}</td>
                    <td className="px-5 py-3">
                      {editing ? (
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className={inputClass}
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold">{item.name}</span>
                      )}
                    </td>
                    <td className="w-0 whitespace-nowrap px-5 py-3">
                      <div className="flex gap-2">
                        <CanEdit resource="productKinds">
                          {editing ? (
                            <>
                              <DirtyUndoButton
                                compact
                                dirty={editName !== item.name}
                                onClick={() => {
                                  if (editName !== item.name) setEditName(item.name);
                                  else cancelEdit();
                                }}
                              />
                              <PrimaryButton
                                type="button"
                                compact
                                onClick={() => {
                                  if (!editName.trim()) {
                                    setNotice({ tone: "error", message: "กรอกชื่อชนิดสินค้า" });
                                    return;
                                  }
                                  setNotice({
                                    tone: "confirm",
                                    message: "ยืนยันบันทึกชนิดสินค้า",
                                    accept: async () =>
                                      setNotice(
                                        await reported(updateProductKind(item.id, editName), "บันทึกชนิดแล้ว", cancelEdit),
                                      ),
                                  });
                                }}
                              >
                                <Glyph icon={Save} />
                                บันทึก
                              </PrimaryButton>
                            </>
                          ) : (
                            <SecondaryButton type="button" className="h-9" onClick={() => startEdit(item)}>
                              <Glyph icon={Pencil} />
                              แก้ไข
                            </SecondaryButton>
                          )}
                        </CanEdit>
                        <CanDelete resource="productKinds">
                          <SecondaryButton
                            type="button"
                            className="h-9"
                            onClick={() =>
                              setNotice({
                                tone: "confirm",
                                message: `ยืนยันลบชนิด ${item.name}`,
                                accept: async () =>
                                  setNotice(
                                    await reported(removeProductKind(item.id), "ลบชนิดแล้ว", () => {
                                      if (editingId === item.id) cancelEdit();
                                    }),
                                  ),
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
      </div>

      {creating && <CreateProductKind onClose={() => setCreating(false)} onCreate={createProductKind} />}
      <NoticeBox notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}

function CreateProductKind({
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
      <Dialog title="เพิ่มชนิดสินค้า" onClose={onClose}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setNotice({ tone: "error", message: "กรอกชื่อชนิดสินค้า" });
              return;
            }
            setNotice({
              tone: "confirm",
              message: "ยืนยันเพิ่มชนิดสินค้า",
              accept: async () => setNotice(await reported(onCreate(name), "เพิ่มชนิดแล้ว", onClose)),
            });
          }}
        >
          <label className="block text-[14px] font-bold leading-[1.4]">
            ชื่อชนิด
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
