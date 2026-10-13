"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, Map, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import {
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  SecondaryButton,
  TableScroll,
  inputClass,
  rowTone,
  tableClass,
} from "@/components/ui";
import {
  apiMessage,
  getLoanHistory,
  listLoanAccountsPage,
  listLoanApplicationsPage,
  listLoanHistoryPage,
  setLoanApplicationDocumentAttached,
  type LoanApplication,
  type LoanApplicationDocument,
  type LoanHistory,
} from "@/lib/api";
import { formatThaiDate } from "@/lib/domain";

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
  draft,
  onDraft,
  onSearch,
  onClear,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
      <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหา</div>
      <form
        className="flex flex-wrap items-end gap-3 px-6 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <label className="block min-w-[240px] flex-1 text-[14px] font-bold">
          ชื่อหรือเบอร์
          <input
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            className={`${inputClass} mt-1 font-normal`}
          />
        </label>
        <PrimaryButton type="submit">
          <Glyph icon={Search} />
          ค้นหา
        </PrimaryButton>
        <PrimaryButton type="button" onClick={onClear}>
          <Glyph icon={RotateCcw} />
          ล้าง
        </PrimaryButton>
      </form>
    </div>
  );
}

/** รออนุมัติ — รายการยื่นขอสินเชื่อ + แผงเอกสาร */
export function LoanPendingScreen() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<LoanApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyDoc, setBusyDoc] = useState(false);

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

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  async function toggleDoc(appId: string, kindId: number, attached: boolean) {
    setBusyDoc(true);
    setError("");
    try {
      const doc = await setLoanApplicationDocumentAttached(appId, kindId, attached);
      setRows((current) =>
        current.map((row) => {
          if (row.id !== appId) return row;
          return {
            ...row,
            documents: row.documents.map((item) =>
              item.kindId === kindId ? { ...item, attached: doc.attached } : item,
            ),
          };
        }),
      );
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setBusyDoc(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="รออนุมัติ" />
      <SearchBar
        draft={draft}
        onDraft={setDraft}
        onSearch={() => {
          setPage(1);
          setQuery(draft.trim());
        }}
        onClear={() => {
          setDraft("");
          setPage(1);
          setQuery("");
        }}
      />
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
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
                  <th className="px-5 py-3 text-left font-bold">เบอร์</th>
                  <th className="px-5 py-3 text-left font-bold">เลขบัตร</th>
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
                    <td colSpan={9} className="px-5 py-6 text-ink/60">
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => {
                  const attached = row.documents.filter((doc) => doc.attached).length;
                  const picked = selected?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={rowTone(index, picked)}
                    >
                      <td className="px-5 py-3 font-bold">{row.farmerName}</td>
                      <td className="px-5 py-3">{row.tel}</td>
                      <td className="px-5 py-3">{row.nationalId}</td>
                      <td className="px-5 py-3 tabular-nums">{formatBaht(row.requestedAmount)}</td>
                      <td className="px-5 py-3">{row.purpose || "—"}</td>
                      <td className="px-5 py-3">{formatDate(row.submittedOn)}</td>
                      <td className="px-5 py-3 tabular-nums">
                        {attached}/{row.documents.length}
                      </td>
                      <td className={`px-5 py-3 font-bold ${statusTone(row.status?.name ?? "")}`}>
                        {row.status?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={row.farmerId ? `/map?farmer=${row.farmerId}` : "/map"}
                          className="inline-flex items-center gap-1 font-bold text-link underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Glyph icon={Map} />
                          แผนที่
                        </Link>
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
        <DocumentPanel application={selected} busy={busyDoc} onToggle={toggleDoc} />
      </div>
    </div>
  );
}

function DocumentPanel({
  application,
  busy,
  onToggle,
}: {
  application: LoanApplication | null;
  busy: boolean;
  onToggle: (appId: string, kindId: number, attached: boolean) => void;
}) {
  return (
    <aside className="w-full shrink-0 overflow-hidden rounded-[8px] border border-frame xl:w-[320px]">
      <div className="bg-bar px-5 py-4 text-[16px] font-bold text-white">เอกสารประกอบ</div>
      <div className="border-b border-frame px-5 py-3 text-[13px] text-ink/70">แนบไฟล์ PDF เท่านั้น</div>
      {!application ? (
        <p className="px-5 py-6 text-[14px] text-ink/60">เลือกรายการเพื่อจัดการเอกสาร</p>
      ) : (
        <ul className="divide-y divide-frame">
          {application.documents.map((doc: LoanApplicationDocument) => (
            <li key={doc.kindId} className="flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 text-ink/50">
                <Glyph icon={FileText} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold leading-snug">{doc.name}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
                  {doc.attached ? (
                    <>
                      <span className="font-bold text-brand">แนบแล้ว</span>
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center gap-1 font-bold text-danger disabled:opacity-50"
                        onClick={() => onToggle(application.id, doc.kindId, false)}
                      >
                        <Glyph icon={Trash2} />
                        ลบไฟล์
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex items-center gap-1 font-bold text-link disabled:opacity-50"
                      onClick={() => onToggle(application.id, doc.kindId, true)}
                    >
                      <Glyph icon={Upload} />
                      แนบไฟล์
                    </button>
                  )}
                </div>
              </div>
              <span
                className={`mt-1 h-4 w-4 shrink-0 rounded-[3px] border ${
                  doc.attached ? "border-brand bg-brand" : "border-line bg-white"
                }`}
                aria-hidden
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** สินเชื่อ — รายการบัญชีสินเชื่อ */
export function LoanAccountsScreen() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listLoanAccountsPage>>["items"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
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
  }, [query, page, pageSize]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="สินเชื่อ" />
      <SearchBar
        draft={draft}
        onDraft={setDraft}
        onSearch={() => {
          setPage(1);
          setQuery(draft.trim());
        }}
        onClear={() => {
          setDraft("");
          setPage(1);
          setQuery("");
        }}
      />
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
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
                <th className="px-5 py-3 text-left font-bold">เบอร์</th>
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
                  <td colSpan={10} className="px-5 py-6 text-ink/60">
                    ยังไม่มีรายการ
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                <tr key={row.id} className={rowTone(index)}>
                  <td className="px-5 py-3 font-bold">{row.name}</td>
                  <td className="px-5 py-3">{row.tel}</td>
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
                    <Link
                      href={row.farmerId ? `/map?farmer=${row.farmerId}` : "/map"}
                      className="inline-flex items-center gap-1 font-bold text-link underline"
                    >
                      <Glyph icon={Map} />
                      แผนที่
                    </Link>
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
    </div>
  );
}

/** ประวัติ — รายการ + หน้ารายละเอียด */
export function LoanHistoryScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = searchParams.get("id");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<LoanHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<LoanHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setError("");
    void getLoanHistory(detailId)
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
  }, [detailId]);

  const refresh = useCallback(async () => {
    if (detailId) return;
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
  }, [query, page, pageSize, detailId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (detailId) {
    return (
      <LoanHistoryDetail
        row={detail}
        loading={detailLoading}
        error={error}
        onBack={() => router.push("/loans/history")}
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="ประวัติ" />
      <SearchBar
        draft={draft}
        onDraft={setDraft}
        onSearch={() => {
          setPage(1);
          setQuery(draft.trim());
        }}
        onClear={() => {
          setDraft("");
          setPage(1);
          setQuery("");
        }}
      />
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
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
                <th className="px-5 py-3 text-left font-bold">เบอร์</th>
                <th className="px-5 py-3 text-left font-bold">เลขบัตร</th>
                <th className="px-5 py-3 text-left font-bold">วงเงิน</th>
                <th className="px-5 py-3 text-left font-bold">วันที่อนุมัติ</th>
                <th className="px-5 py-3 text-left font-bold">วันที่โอน</th>
                <th className="px-5 py-3 text-left font-bold">ผลลัพธ์</th>
                <th className="px-5 py-3 text-left font-bold" />
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
              {rows.map((row, index) => (
                <tr key={row.id} className={rowTone(index)}>
                  <td className="px-5 py-3 font-bold">{row.farmerName}</td>
                  <td className="px-5 py-3">{row.tel}</td>
                  <td className="px-5 py-3">{row.nationalId}</td>
                  <td className="px-5 py-3 tabular-nums">{formatBaht(row.amount)}</td>
                  <td className="px-5 py-3">{formatDate(row.approvedOn)}</td>
                  <td className="px-5 py-3">{formatDate(row.transferredOn)}</td>
                  <td className={`px-5 py-3 font-bold ${statusTone(row.result?.name ?? "")}`}>
                    {row.result?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <SecondaryButton className="h-9" onClick={() => router.push(`/loans/history?id=${row.id}`)}>
                      ดูรายละเอียด
                    </SecondaryButton>
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
    </div>
  );
}

function LoanHistoryDetail({
  row,
  loading,
  error,
  onBack,
}: {
  row: LoanHistory | null;
  loading: boolean;
  error: string;
  onBack: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[14px] text-ink/60">กำลังโหลด…</div>
    );
  }

  if (!row) {
    return (
      <div className="h-full overflow-y-auto px-7 py-6">
        <PageHeader current="ประวัติ" />
        <p className="text-[14px] text-danger">{error || "ไม่พบรายการ"}</p>
        <SecondaryButton className="mt-4" onClick={onBack}>
          <Glyph icon={ArrowLeft} />
          กลับ
        </SecondaryButton>
      </div>
    );
  }

  const fields: { label: string; value: string; tone?: string }[] = [
    { label: "เกษตรกร", value: row.farmerName },
    { label: "เบอร์", value: row.tel },
    { label: "เลขบัตร", value: row.nationalId },
    { label: "วงเงิน", value: formatBaht(row.amount) },
    { label: "วัตถุประสงค์", value: row.purpose || "—" },
    { label: "วันที่อนุมัติ", value: formatDate(row.approvedOn) },
    { label: "วันที่โอน", value: formatDate(row.transferredOn) },
    { label: "ผลลัพธ์", value: row.result?.name ?? "—", tone: statusTone(row.result?.name ?? "") },
    { label: "หมายเหตุ", value: row.note || "—" },
  ];

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader
        current="รายละเอียดประวัติ"
        action={
          <SecondaryButton onClick={onBack}>
            <Glyph icon={ArrowLeft} />
            กลับ
          </SecondaryButton>
        }
      />
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ประวัติสินเชื่อ</div>
        <dl className="grid gap-0 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="border-b border-frame px-6 py-4 sm:odd:border-r">
              <dt className="text-[12px] text-ink/60">{field.label}</dt>
              <dd className={`mt-1 text-[14px] font-bold ${field.tone ?? ""}`}>{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
