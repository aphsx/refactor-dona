"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileText, Map, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import {
  ConfirmAlert,
  Dialog,
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  StatusTab,
  TableScroll,
  inputClass,
  openRow,
  rowTone,
  tableClass,
} from "@/components/ui";
import {
  api,
  apiMessage,
  getLoanAccount,
  getLoanHistory,
  listLoanAccountsPage,
  listLoanApplicationsPage,
  listLoanHistoryPage,
  setLoanApplicationDocumentAttached,
  uploadLoanDocument,
  type LoanAccount,
  type LoanApplication,
  type LoanApplicationDocument,
  type LoanHistory,
} from "@/lib/api";
import {
  farmerColor,
  farmerName,
  formatThaiDate,
  isLoanDocumentRequired,
  loanRequiredDocumentProgress,
  type Farmer,
} from "@/lib/domain";
import { placeLabel } from "@/lib/thai-place";

const FieldMap = dynamic(() => import("@/components/field-map").then((mod) => mod.FieldMap), { ssr: false });

function statusTone(status: string) {
  if (status === "อนุมัติ" || status === "คำขอปกติ") return "text-brand";
  if (status === "ปฏิเสธ" || status === "NPL" || status === "ยกเลิก") return "text-danger";
  if (status === "ค้างชำระ" || status === "รอเอกสาร") return "text-amber-700";
  return "text-ink";
}

function formatBaht(value: number) {
  return Number(value).toLocaleString("th-TH");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return formatThaiDate(value.slice(0, 10));
}

function SearchBar({
  draftName,
  draftNationalId,
  onDraftName,
  onDraftNationalId,
  onSearch,
  onClear,
  underTab = false,
}: {
  draftName: string;
  draftNationalId: string;
  onDraftName: (value: string) => void;
  onDraftNationalId: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  /** Under StatusTab — no top-left radius so it joins the tab. */
  underTab?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden border border-frame ${
        underTab ? "rounded-b-[8px] rounded-tr-[8px]" : "rounded-[8px]"
      }`}
    >
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหา</div>
      <form
        className="grid gap-4 px-6 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อ
          <input
            value={draftName}
            onChange={(event) => onDraftName(event.target.value)}
            className={`${inputClass} mt-1 font-normal`}
          />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          เลขบัตรประชาชน
          <input
            value={draftNationalId}
            inputMode="numeric"
            placeholder="13 หลัก"
            onChange={(event) => onDraftNationalId(event.target.value)}
            className={`${inputClass} mt-1 font-normal`}
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <PrimaryButton type="submit">
            <Glyph icon={Search} />
            ค้นหา
          </PrimaryButton>
          <PrimaryButton type="button" onClick={onClear}>
            <Glyph icon={RotateCcw} />
            ล้าง
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function searchQuery(name: string, nationalId: string) {
  return [name, nationalId].filter((part) => part.trim()).join(" ");
}

const detailFieldClass = `${inputClass} mt-1 disabled:bg-[#E7E7E7]`;

function DetailSection({
  title,
  children,
  bare = false,
}: {
  title?: string;
  children: ReactNode;
  /** Fields directly under main header — no section bar. */
  bare?: boolean;
}) {
  return (
    <>
      {!bare && title && (
        <div className="border-t border-frame bg-bar px-6 py-3 text-[14px] font-bold text-white">{title}</div>
      )}
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">{children}</div>
    </>
  );
}

function ReadField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <label className={`block text-[14px] font-bold leading-[1.4] ${className}`}>
      {label}
      <input value={value} disabled className={detailFieldClass} />
    </label>
  );
}

function FarmerPeekDialog({ farmerId, onClose }: { farmerId: string; onClose: () => void }) {
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const { hasPlots, ready: plotsReady } = useFarmerHasPlots(farmerId);
  const mapDisabled = !plotsReady || !hasPlots;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void api
      .getFarmer(farmerId)
      .then((row) => {
        if (!alive) return;
        setFarmer(row);
      })
      .catch((err) => {
        if (!alive) return;
        setError(apiMessage(err));
        setFarmer(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [farmerId]);

  return (
    <>
      <Dialog title="รายละเอียดเกษตรกร" wide onClose={onClose}>
        {loading && <p className="text-[14px] text-ink/60">กำลังโหลด…</p>}
        {!loading && error && <p className="text-[14px] text-danger">{error}</p>}
        {!loading && farmer && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadField label="ชื่อ" value={farmer.firstName || "—"} />
              <ReadField label="นามสกุล" value={farmer.lastName || "—"} />
              <ReadField label="เลขบัตรประชาชน" value={farmer.nationalId || "—"} />
              <ReadField label="กลุ่ม" value={farmer.groupName || "—"} />
              <ReadField label="ที่อยู่" value={farmer.address || "—"} className="sm:col-span-2" />
              <ReadField label="ตำบล / อำเภอ / จังหวัด" value={placeLabel(farmer)} className="sm:col-span-2" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                className="h-9"
                disabled={mapDisabled}
                title={mapDisabled && plotsReady ? "ยังไม่มีแปลง" : undefined}
                onClick={() => setMapOpen(true)}
              >
                <Glyph icon={Map} />
                แผนที่แปลง
              </PrimaryButton>
            </div>
          </>
        )}
      </Dialog>
      {mapOpen && hasPlots && <MapPeekDialog farmerId={farmerId} onClose={() => setMapOpen(false)} />}
    </>
  );
}

function MapPeekDialog({ farmerId, onClose }: { farmerId: string; onClose: () => void }) {
  const [titleName, setTitleName] = useState("");
  const [plots, setPlots] = useState<
    { id: string; name: string; color: string; muted: boolean; polygon: [number, number][] }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void Promise.all([api.getFarmer(farmerId), api.listPlotBoundaries({ farmerId })])
      .then(([farmer, boundaries]) => {
        if (!alive) return;
        setTitleName(farmerName(farmer));
        const color = farmerColor(farmerId);
        const next = boundaries.map((item) => ({
          id: item.id,
          name: item.name,
          color,
          muted: false,
          polygon: item.polygon,
        }));
        // No auto-select — FieldMap fits all unmuted plots (farmer filter view).
        setPlots(next);
        setSelectedId(null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(apiMessage(err));
        setPlots([]);
        setSelectedId(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [farmerId]);

  const selected = plots.find((plot) => plot.id === selectedId) ?? null;

  return (
    <Dialog title={titleName ? `แผนที่แปลง · ${titleName}` : "แผนที่แปลง"} wide onClose={onClose}>
      {loading && <p className="text-[14px] text-ink/60">กำลังโหลด…</p>}
      {!loading && error && <p className="text-[14px] text-danger">{error}</p>}
      {!loading && !error && plots.length === 0 && (
        <p className="text-[14px] text-ink/60">ยังไม่มีรูปแปลงของเกษตรกรรายนี้</p>
      )}
      {!loading && !error && plots.length > 0 && (
        <div className="flex h-[min(720px,calc(100vh-10rem))] flex-col">
          <p className="mb-3 shrink-0 text-[14px]">
            {selected
              ? `${selected.name} · จากทั้งหมด ${plots.length} แปลง`
              : `${plots.length} แปลงของเกษตรกรรายนี้`}
          </p>
          <div className="min-h-0 flex-1 overflow-hidden">
            <FieldMap
              plots={plots}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
              bottomInset={48}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}

const linkCursorClass = "cursor-pointer";

function useFarmerHasPlots(farmerId: string | null) {
  const [hasPlots, setHasPlots] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!farmerId) {
      setHasPlots(false);
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    void api
      .listPlotsPage({ farmerId, page: 1, pageSize: 1 })
      .then((page) => {
        if (!alive) return;
        setHasPlots((page.total ?? 0) > 0);
      })
      .catch(() => {
        if (alive) setHasPlots(false);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [farmerId]);

  return { hasPlots, ready };
}

function MapLink({
  farmerId,
  className,
  children,
}: {
  farmerId: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { hasPlots, ready } = useFarmerHasPlots(farmerId);
  const disabled = !farmerId || !ready || !hasPlots;

  if (!farmerId) {
    return <span className="text-ink/40">{children ?? "แผนที่"}</span>;
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={disabled && ready ? "ยังไม่มีแปลง" : undefined}
        className={
          className
            ? `${className} ${
                disabled
                  ? "cursor-not-allowed opacity-50 hover:bg-white disabled:pointer-events-none disabled:border-[#D0D0D0] disabled:text-[#B0B0B0]"
                  : linkCursorClass
              }`
            : disabled
              ? "inline-flex items-center gap-1 font-bold text-ink/40 cursor-not-allowed"
              : `inline-flex items-center gap-1 font-bold text-link underline ${linkCursorClass}`
        }
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          setOpen(true);
        }}
      >
        {children ?? (
          <>
            <Glyph icon={Map} />
            แผนที่
          </>
        )}
      </button>
      {open && !disabled && <MapPeekDialog farmerId={farmerId} onClose={() => setOpen(false)} />}
    </>
  );
}

function FarmerLink({
  farmerId,
  name,
  className,
  children,
}: {
  farmerId: string | null;
  name: string;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!farmerId) return <span className="font-bold">{children ?? name}</span>;
  return (
    <>
      <button
        type="button"
        className={
          className
            ? `${className} ${linkCursorClass}`
            : `font-bold text-link underline ${linkCursorClass}`
        }
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children ?? name}
      </button>
      {open && <FarmerPeekDialog farmerId={farmerId} onClose={() => setOpen(false)} />}
    </>
  );
}

/** รออนุมัติ — ตาราง + แผงเอกสาร (ไม่มีหน้ารายละเอียด) */
export function LoanPendingScreen() {
  const [draftName, setDraftName] = useState("");
  const [draftNationalId, setDraftNationalId] = useState("");
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<LoanApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyKindId, setBusyKindId] = useState<number | null>(null);
  const query = searchQuery(name, nationalId);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listLoanApplicationsPage({ q: query, page, pageSize });
      const items = data.items ?? [];
      setRows(items);
      setTotal(data.total ?? 0);
      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id ?? null;
      });
    } catch (err) {
      setError(apiMessage(err));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function patchLocalDoc(appId: string, kindId: number, doc: LoanApplicationDocument) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== appId) return row;
        return {
          ...row,
          documents: row.documents.map((item) =>
            item.kindId === kindId ? { ...item, ...doc } : item,
          ),
        };
      }),
    );
  }

  async function removeDoc(appId: string, kindId: number) {
    setBusyKindId(kindId);
    setError("");
    try {
      const doc = await setLoanApplicationDocumentAttached(appId, kindId, false);
      patchLocalDoc(appId, kindId, doc);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusyKindId(null);
    }
  }

  async function attachDoc(appId: string, kindId: number, file: File) {
    setBusyKindId(kindId);
    setError("");
    try {
      const doc = await uploadLoanDocument(appId, kindId, file);
      patchLocalDoc(appId, kindId, doc);
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusyKindId(null);
    }
  }

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="รออนุมัติ" />
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      <div className="mb-6">
        <SearchBar
          draftName={draftName}
          draftNationalId={draftNationalId}
          onDraftName={setDraftName}
          onDraftNationalId={setDraftNationalId}
          onSearch={() => {
            setPage(1);
            setName(draftName);
            setNationalId(draftNationalId);
          }}
          onClear={() => {
            setDraftName("");
            setDraftNationalId("");
            setPage(1);
            setName("");
            setNationalId("");
          }}
        />
      </div>
      <div className="flex min-h-0 flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-frame">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
            รายการยื่นขอสินเชื่อ
            <span className="text-[14px] font-normal">{loading ? "กำลังโหลด…" : `${total} รายการ`}</span>
          </div>
          <TableScroll>
            <table className={tableClass}>
              <thead className="bg-table">
                <tr>
                  <th className="px-5 py-3 text-left font-bold">เกษตรกร</th>
                  <th className="px-5 py-3 text-left font-bold">เลขบัตรประชาชน</th>
                  <th className="px-5 py-3 text-left font-bold">วงเงินที่ขอ</th>
                  <th className="px-5 py-3 text-left font-bold">วัตถุประสงค์</th>
                  <th className="px-5 py-3 text-left font-bold">วันที่ยื่น</th>
                  <th className="px-5 py-3 text-left font-bold">เอกสาร</th>
                  <th className="px-5 py-3 text-left font-bold">สถานะ</th>
                  <th className="px-5 py-3 text-left font-bold">แปลง</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-ink/60">
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => {
                  const docs = loanRequiredDocumentProgress(row.documents);
                  return (
                    <tr
                      key={row.id}
                      onClick={(event) => openRow(event, () => setSelectedId(row.id))}
                      className={rowTone(index, selectedId === row.id)}
                    >
                      <td className="px-5 py-3">
                        <FarmerLink farmerId={row.farmerId} name={row.farmerName} />
                      </td>
                      <td className="px-5 py-3">{row.nationalId}</td>
                      <td className="px-5 py-3 tabular-nums">{formatBaht(row.requestedAmount)}</td>
                      <td className="px-5 py-3">{row.purpose || "—"}</td>
                      <td className="px-5 py-3">{formatDate(row.submittedOn)}</td>
                      <td className="px-5 py-3 tabular-nums">
                        {docs.attached}/{docs.total}
                      </td>
                      <td className={`px-5 py-3 font-bold ${statusTone(row.status?.name ?? "")}`}>
                        {row.status?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <MapLink farmerId={row.farmerId} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
          />
        </div>
        <DocumentPanel
          application={selected}
          busyKindId={busyKindId}
          onUpload={attachDoc}
          onRemove={removeDoc}
        />
      </div>
    </div>
  );
}

function DocumentPanel({
  application,
  busyKindId,
  onUpload,
  onRemove,
}: {
  application: LoanApplication | null;
  busyKindId: number | null;
  onUpload: (appId: string, kindId: number, file: File) => void;
  onRemove: (appId: string, kindId: number) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<{ kindId: number; name: string } | null>(null);
  const anyBusy = busyKindId != null;

  return (
    <aside className="w-full shrink-0 overflow-hidden rounded-[8px] border border-frame xl:w-[320px]">
      <div className="bg-bar px-5 py-4 text-[16px] font-bold text-white">เอกสารประกอบ</div>
      <div className="border-b border-frame px-5 py-3 text-[13px] text-ink/70">
        แนบ PDF หรือรูป — บีบขนาดอัตโนมัติก่อนอัปโหลด
      </div>
      {!application ? (
        <p className="px-5 py-6 text-[14px] text-ink/60">เลือกรายการเพื่อจัดการเอกสาร</p>
      ) : (
        <ul className="divide-y divide-frame">
          {application.documents.map((doc: LoanApplicationDocument) => {
            const required = isLoanDocumentRequired(doc);
            const fileUrl =
              doc.storagePath?.startsWith("http") ? doc.storagePath : null;
            const rowBusy = busyKindId === doc.kindId;
            return (
            <li key={doc.kindId} className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 text-ink/50">
                <Glyph icon={FileText} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold leading-snug">
                  {doc.name}
                  {required && <span className="ml-0.5 text-danger">*</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                  {doc.attached ? (
                    <>
                      <span className="font-bold text-brand">แนบแล้ว</span>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-link underline-offset-2 hover:underline"
                        >
                          ดูไฟล์
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={anyBusy}
                        className="inline-flex cursor-pointer items-center gap-1 font-bold text-danger underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => setPendingDelete({ kindId: doc.kindId, name: doc.name })}
                      >
                        <Glyph icon={Trash2} />
                        {rowBusy ? "กำลังลบ…" : "ลบไฟล์"}
                      </button>
                    </>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-1 font-bold text-link underline-offset-2 hover:underline has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                      <Glyph icon={Upload} />
                      {rowBusy ? "กำลังอัป…" : "แนบไฟล์"}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={anyBusy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          onUpload(application.id, doc.kindId, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              <span
                aria-hidden
                className={`mt-1 h-4 w-4 shrink-0 rounded-[3px] border ${
                  doc.attached ? "border-brand bg-brand" : "border-line bg-white"
                }`}
              />
            </li>
            );
          })}
        </ul>
      )}
      {pendingDelete && application && (
        <ConfirmAlert
          message={`ยืนยันลบไฟล์ ${pendingDelete.name}?`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const { kindId } = pendingDelete;
            setPendingDelete(null);
            onRemove(application.id, kindId);
          }}
        />
      )}
    </aside>
  );
}

/** สินเชื่อ — รายการ → กดแถวเข้าดูรายละเอียด */
export function LoanAccountsScreen() {
  const router = useRouter();
  const requestedId = useSearchParams().get("id");
  const [tab, setTab] = useState<"listing" | "detail">(requestedId ? "detail" : "listing");
  const [draftName, setDraftName] = useState("");
  const [draftNationalId, setDraftNationalId] = useState("");
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<LoanAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [detail, setDetail] = useState<LoanAccount | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const query = searchQuery(name, nationalId);

  const refresh = useCallback(async () => {
    if (tab === "detail") return;
    setLoading(true);
    setError("");
    try {
      const data = await listLoanAccountsPage({ q: query, page, pageSize });
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(apiMessage(err));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!requestedId) {
      setTab("listing");
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(requestedId);
    setTab("detail");
    let alive = true;
    setDetailLoading(true);
    setError("");
    void getLoanAccount(requestedId)
      .then((item) => {
        if (alive) setDetail(item);
      })
      .catch((err) => {
        if (alive) {
          setDetail(null);
          setError(apiMessage(err));
        }
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [requestedId]);

  function openDetail(id: string) {
    setSelectedId(id);
    setTab("detail");
    router.replace(`/loans?id=${id}`);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setTab("listing");
    router.replace("/loans");
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="สินเชื่อ" />
      <div className="flex items-end gap-1">
        <StatusTab label="รายการ" active={tab === "listing"} onClick={closeDetail} />
        {tab === "detail" && (
          <StatusTab label="รายละเอียด" active onClick={() => setTab("detail")} />
        )}
      </div>
      {error && tab === "listing" && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      {tab === "listing" && (
        <>
          <div className="mb-6">
            <SearchBar
              underTab
              draftName={draftName}
              draftNationalId={draftNationalId}
              onDraftName={setDraftName}
              onDraftNationalId={setDraftNationalId}
              onSearch={() => {
                setPage(1);
                setName(draftName);
                setNationalId(draftNationalId);
              }}
              onClear={() => {
                setDraftName("");
                setDraftNationalId("");
                setPage(1);
                setName("");
                setNationalId("");
              }}
            />
          </div>
          <div className="overflow-hidden rounded-[8px] border border-frame">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
              รายการสินเชื่อ
              <span className="text-[14px] font-normal">{loading ? "กำลังโหลด…" : `${total} รายการ`}</span>
            </div>
            <TableScroll>
              <table className={tableClass}>
                <thead className="bg-table">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold">ชื่อ</th>
                    <th className="px-5 py-3 text-left font-bold">เลขบัตรประชาชน</th>
                    <th className="px-5 py-3 text-left font-bold">วงเงิน</th>
                    <th className="px-5 py-3 text-left font-bold">ยอดคงเหลือ</th>
                    <th className="px-5 py-3 text-left font-bold">งวด/เดือน</th>
                    <th className="px-5 py-3 text-left font-bold">ค้าง (ครั้งถัดไป)</th>
                    <th className="px-5 py-3 text-left font-bold">ค้างล่าสุด</th>
                    <th className="px-5 py-3 text-left font-bold">สถานะ</th>
                    <th className="px-5 py-3 text-left font-bold">แปลง</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-6 text-ink/60">
                        ยังไม่มีรายการ
                      </td>
                    </tr>
                  )}
                  {rows.map((row, index) => (
                    <tr
                      key={row.id}
                      onClick={(event) => openRow(event, () => openDetail(row.id))}
                      className={rowTone(index, selectedId === row.id)}
                    >
                      <td className="px-5 py-3">
                        <FarmerLink farmerId={row.farmerId} name={row.name} />
                      </td>
                      <td className="px-5 py-3">{row.nationalId}</td>
                      <td className="px-5 py-3 tabular-nums">{formatBaht(row.creditLimit)}</td>
                      <td className="px-5 py-3 tabular-nums">{formatBaht(row.balance)}</td>
                      <td className="px-5 py-3 tabular-nums">{row.installmentMonths}</td>
                      <td className="px-5 py-3">{formatDate(row.nextDue)}</td>
                      <td className="px-5 py-3">{formatDate(row.lastDue)}</td>
                      <td className={`px-5 py-3 font-bold ${statusTone(row.status?.name ?? "")}`}>
                        {row.status?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <MapLink farmerId={row.farmerId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPage(1);
                setPageSize(size);
              }}
            />
          </div>
        </>
      )}
      {tab === "detail" && (
        <div className="overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <AccountDetail row={detail} loading={detailLoading} error={error} onClose={closeDetail} />
        </div>
      )}
    </div>
  );
}

function AccountDetail({
  row,
  loading,
  error,
  onClose,
}: {
  row: LoanAccount | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  if (loading) {
    return <div className="px-6 py-8 text-[14px] text-ink/60">กำลังโหลด…</div>;
  }
  if (!row) {
    return <div className="px-6 py-8 text-[14px] text-danger">{error || "ไม่พบรายการ"}</div>;
  }

  const statusName = row.status?.name ?? "—";

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดสินเชื่อ
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <DetailSection bare>
        <div className="block text-[14px] font-bold leading-[1.4]">
          ชื่อ
          <div className="mt-2">
            <FarmerLink farmerId={row.farmerId} name={row.name} />
          </div>
        </div>
        <ReadField label="เลขบัตรประชาชน" value={row.nationalId} />
        <ReadField label="สถานะ" value={statusName} />
      </DetailSection>
      <DetailSection title="วงเงินและงวด">
        <ReadField label="วงเงิน" value={formatBaht(row.creditLimit)} />
        <ReadField label="ยอดคงเหลือ" value={formatBaht(row.balance)} />
        <ReadField label="งวด/เดือน" value={String(row.installmentMonths)} />
        <ReadField label="ค้าง (ครั้งถัดไป)" value={formatDate(row.nextDue)} />
        <ReadField label="ค้างล่าสุด" value={formatDate(row.lastDue)} />
        <div className="block text-[14px] font-bold leading-[1.4]">
          แปลง
          <div className="mt-2">
            <MapLink farmerId={row.farmerId} />
          </div>
        </div>
      </DetailSection>
      {row.farmerId && (
        <div className="flex flex-wrap gap-3 border-t border-frame px-6 py-4">
          <FarmerLink
            farmerId={row.farmerId}
            name={row.name}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border-2 border-brand bg-white px-4 text-[14px] font-bold text-brand hover:bg-pick"
          >
            ดูเกษตรกร
          </FarmerLink>
          <MapLink
            farmerId={row.farmerId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border-2 border-brand bg-white px-4 text-[14px] font-bold text-brand hover:bg-pick"
          >
            <Glyph icon={Map} />
            แผนที่
          </MapLink>
        </div>
      )}
    </>
  );
}

/** ประวัติ — รายการ → กดแถวเข้าดูรายละเอียด (ไม่มีปุ่มดูรายละเอียด) */
export function LoanHistoryScreen() {
  const router = useRouter();
  const requestedId = useSearchParams().get("id");
  const [tab, setTab] = useState<"listing" | "detail">(requestedId ? "detail" : "listing");
  const [draftName, setDraftName] = useState("");
  const [draftNationalId, setDraftNationalId] = useState("");
  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<LoanHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [detail, setDetail] = useState<LoanHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const query = searchQuery(name, nationalId);

  const refresh = useCallback(async () => {
    if (tab === "detail") return;
    setLoading(true);
    setError("");
    try {
      const data = await listLoanHistoryPage({ q: query, page, pageSize });
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(apiMessage(err));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!requestedId) {
      setTab("listing");
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(requestedId);
    setTab("detail");
    let alive = true;
    setDetailLoading(true);
    setError("");
    void getLoanHistory(requestedId)
      .then((item) => {
        if (alive) setDetail(item);
      })
      .catch((err) => {
        if (alive) {
          setDetail(null);
          setError(apiMessage(err));
        }
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [requestedId]);

  function openDetail(id: string) {
    setSelectedId(id);
    setTab("detail");
    router.replace(`/loans/history?id=${id}`);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setTab("listing");
    router.replace("/loans/history");
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="ประวัติ" />
      <div className="flex items-end gap-1">
        <StatusTab label="รายการ" active={tab === "listing"} onClick={closeDetail} />
        {tab === "detail" && (
          <StatusTab label="รายละเอียด" active onClick={() => setTab("detail")} />
        )}
      </div>
      {error && tab === "listing" && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      {tab === "listing" && (
        <>
          <div className="mb-6">
            <SearchBar
              underTab
              draftName={draftName}
              draftNationalId={draftNationalId}
              onDraftName={setDraftName}
              onDraftNationalId={setDraftNationalId}
              onSearch={() => {
                setPage(1);
                setName(draftName);
                setNationalId(draftNationalId);
              }}
              onClear={() => {
                setDraftName("");
                setDraftNationalId("");
                setPage(1);
                setName("");
                setNationalId("");
              }}
            />
          </div>
          <div className="overflow-hidden rounded-[8px] border border-frame">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
              รายการประวัติ
              <span className="text-[14px] font-normal">{loading ? "กำลังโหลด…" : `${total} รายการ`}</span>
            </div>
            <TableScroll>
              <table className={tableClass}>
                <thead className="bg-table">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold">เกษตรกร</th>
                    <th className="px-5 py-3 text-left font-bold">เลขบัตรประชาชน</th>
                    <th className="px-5 py-3 text-left font-bold">วงเงิน</th>
                    <th className="px-5 py-3 text-left font-bold">วันที่อนุมัติ</th>
                    <th className="px-5 py-3 text-left font-bold">วันที่โอน</th>
                    <th className="px-5 py-3 text-left font-bold">ผลลัพธ์</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-ink/60">
                        ยังไม่มีรายการ
                      </td>
                    </tr>
                  )}
                  {rows.map((row, index) => (
                    <tr
                      key={row.id}
                      onClick={(event) => openRow(event, () => openDetail(row.id))}
                      className={rowTone(index, selectedId === row.id)}
                    >
                      <td className="px-5 py-3">
                        <FarmerLink farmerId={row.farmerId} name={row.farmerName} />
                      </td>
                      <td className="px-5 py-3">{row.nationalId}</td>
                      <td className="px-5 py-3 tabular-nums">{formatBaht(row.amount)}</td>
                      <td className="px-5 py-3">{formatDate(row.approvedOn)}</td>
                      <td className="px-5 py-3">{formatDate(row.transferredOn)}</td>
                      <td className={`px-5 py-3 font-bold ${statusTone(row.result?.name ?? "")}`}>
                        {row.result?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPage(1);
                setPageSize(size);
              }}
            />
          </div>
        </>
      )}
      {tab === "detail" && (
        <div className="overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <HistoryDetail row={detail} loading={detailLoading} error={error} onClose={closeDetail} />
        </div>
      )}
    </div>
  );
}

function HistoryDetail({
  row,
  loading,
  error,
  onClose,
}: {
  row: LoanHistory | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  if (loading) {
    return <div className="px-6 py-8 text-[14px] text-ink/60">กำลังโหลด…</div>;
  }
  if (!row) {
    return <div className="px-6 py-8 text-[14px] text-danger">{error || "ไม่พบรายการ"}</div>;
  }

  const resultName = row.result?.name ?? "—";

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
        รายละเอียดประวัติ
        <button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-1 text-[12px] text-bar">
          ปิด
        </button>
      </div>
      <DetailSection bare>
        <div className="block text-[14px] font-bold leading-[1.4]">
          เกษตรกร
          <div className="mt-2">
            <FarmerLink farmerId={row.farmerId} name={row.farmerName} />
          </div>
        </div>
        <ReadField label="เลขบัตรประชาชน" value={row.nationalId} />
        <ReadField label="ผลลัพธ์" value={resultName} />
      </DetailSection>
      <DetailSection title="รายละเอียดสินเชื่อ">
        <ReadField label="วงเงิน" value={formatBaht(row.amount)} />
        <ReadField label="วัตถุประสงค์" value={row.purpose || "—"} />
        <ReadField label="วันที่อนุมัติ" value={formatDate(row.approvedOn)} />
        <ReadField label="วันที่โอน" value={formatDate(row.transferredOn)} />
        <ReadField label="หมายเหตุ" value={row.note || "—"} className="sm:col-span-2" />
      </DetailSection>
      {row.farmerId && (
        <div className="flex flex-wrap gap-3 border-t border-frame px-6 py-4">
          <FarmerLink
            farmerId={row.farmerId}
            name={row.farmerName}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border-2 border-brand bg-white px-4 text-[14px] font-bold text-brand hover:bg-pick"
          >
            ดูเกษตรกร
          </FarmerLink>
          <MapLink
            farmerId={row.farmerId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border-2 border-brand bg-white px-4 text-[14px] font-bold text-brand hover:bg-pick"
          >
            <Glyph icon={Map} />
            แผนที่
          </MapLink>
        </div>
      )}
    </>
  );
}
