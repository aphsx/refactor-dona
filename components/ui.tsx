"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleX, RotateCcw, Search, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { farmerHandle, formatThaiDate, formatThaiMonth } from "@/lib/mill";

export const inputClass =
  "h-10 w-full rounded-[4px] border border-line bg-white px-3 text-[14px] text-ink placeholder:text-ink/20";

export function Glyph({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />;
}

export function openRow(event: React.MouseEvent<HTMLElement>, action: () => void) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().length > 0) return;
  if (target.closest("a,button,input,textarea,select,[role='button']")) return;
  action();
}

export function rowTone(index: number, picked = false) {
  return `cursor-pointer ${picked ? "bg-pick" : index % 2 === 1 ? "bg-table" : "bg-white"}`;
}

export const tableClass = "w-max min-w-full border-collapse whitespace-nowrap text-left text-[14px]";

export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto scroll-smooth overscroll-x-contain">{children}</div>;
}

export type SortState = { key: string; dir: "asc" | "desc" } | null;

export function useTableSort(resetKey = "") {
  const [sort, setSort] = useState<SortState>(null);
  useEffect(() => {
    setSort(null);
  }, [resetKey]);
  function toggleSort(key: string) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }
  return { sort, toggleSort };
}

export function orderBy<T>(rows: T[], sort: SortState, valueOf: (row: T, key: string) => string | number) {
  if (!sort) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const left = valueOf(a, sort.key);
    const right = valueOf(b, sort.key);
    if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
    return String(left).localeCompare(String(right), "th", { numeric: true }) * dir;
  });
}

export function SortableTh({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column?: string;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  const active = column != null && sort?.key === column;
  return (
    <th className="border-r border-white px-5 py-3 font-bold last:border-r-0">
      {column ? (
        <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1">
          {label}
          <ChevronDown size={14} strokeWidth={1.75} className={`shrink-0 ${active ? (sort.dir === "asc" ? "rotate-180" : "") : "opacity-40"}`} />
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function isWildcard(query: string) {
  const value = query.trim();
  return value === "" || value === "%";
}

export function matchesQuery(query: string, text: string) {
  if (isWildcard(query)) return true;
  const needle = query.trim().toLocaleLowerCase("th");
  const haystack = text.toLocaleLowerCase("th");
  if (haystack.includes(needle)) return true;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && haystack.replace(/\D/g, "").includes(digits);
}

export function PrimaryButton({
  children,
  className = "",
  compact = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { compact?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex cursor-pointer select-none items-center justify-center rounded-[6px] bg-brand text-[14px] font-bold text-white transition-colors hover:bg-brand-hover active:bg-sidebar disabled:pointer-events-none disabled:bg-[#D0D0D0] ${compact ? "h-8 gap-2 px-3" : "h-10 gap-4 px-5"} ${className}`}
    >
      {children}
    </button>
  );
}

export function DirtyUndoButton({
  dirty,
  compact = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { dirty: boolean; compact?: boolean }) {
  return (
    <PrimaryButton compact={compact} className={className} {...props}>
      <Glyph icon={dirty ? RotateCcw : CircleX} />
      {dirty ? "เลิกทำ" : "ยกเลิก"}
    </PrimaryButton>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-10 cursor-pointer select-none items-center justify-center gap-2 rounded-[6px] border-2 border-brand bg-white px-4 text-[14px] font-bold text-brand transition-colors hover:bg-pick active:bg-table disabled:pointer-events-none disabled:border-[#D0D0D0] disabled:text-[#B0B0B0] ${className}`}
    >
      {children}
    </button>
  );
}

export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full overflow-hidden rounded-[8px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${wide ? "max-w-[960px]" : "max-w-[560px]"}`}>
        <div className="flex items-center justify-between bg-bar px-6 py-4 text-[16px] font-bold text-white">
          {title}
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-bar"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function AlertFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[420px] rounded-[8px] bg-white px-8 py-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.18)]">{children}</div>
    </div>
  );
}

export function ResultAlert({
  kind,
  message,
  onClose,
}: {
  kind: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const Icon = kind === "success" ? CircleCheck : CircleX;
  return (
    <AlertFrame>
      <Icon className={`mx-auto ${kind === "success" ? "text-ok" : "text-danger"}`} size={96} strokeWidth={1.25} />
      <p className="mt-4 text-[18px] font-bold">{message}</p>
      <div className="mt-6 flex justify-center">
        <PrimaryButton onClick={onClose}>
          <Glyph icon={Check} />
          ตกลง
        </PrimaryButton>
      </div>
    </AlertFrame>
  );
}

export function ConfirmAlert({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // Sync lock: React state alone loses double-clicks before re-render.
  const locked = useRef(false);

  return (
    <AlertFrame>
      <CircleAlert className="mx-auto text-brand" size={96} strokeWidth={1.25} />
      <p className="mt-4 text-[18px] font-bold">{message}</p>
      {busy && <p className="mt-2 text-[14px] text-ink/60">กำลังบันทึก…</p>}
      <div className="mt-6 flex justify-center gap-3">
        <SecondaryButton
          disabled={busy}
          onClick={() => {
            if (locked.current) return;
            onCancel();
          }}
        >
          <Glyph icon={X} />
          ยกเลิก
        </SecondaryButton>
        <PrimaryButton
          disabled={busy}
          onClick={() => {
            if (locked.current) return;
            locked.current = true;
            setBusy(true);
            void Promise.resolve(onConfirm()).catch(() => {
              // Only unlock on failure so the user can retry. Success replaces this dialog.
              locked.current = false;
              setBusy(false);
            });
          }}
        >
          <Glyph icon={Check} />
          {busy ? "กำลังบันทึก…" : "ยืนยัน"}
        </PrimaryButton>
      </div>
    </AlertFrame>
  );
}

export function PageHeader({
  current,
  action,
}: {
  current: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="text-[14px] font-light">
        dona
        <span className="px-2 text-ink/40">/</span>
        <span className="font-bold">{current}</span>
      </div>
      {action}
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-frame bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="text-[12px] text-ink/70">{label}</div>
      <div className="mt-2 text-[16px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function StatusTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-[6px] px-5 font-bold text-[16px] ${active ? "h-12 bg-bar text-white" : "h-11 bg-table text-ink"}`}
    >
      {label}
    </button>
  );
}

const PAGE_SIZES = [10, 20, 50, 100];

export function usePagination<T>(items: T[], resetKey = "") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (current - 1) * pageSize;
  return {
    page: current,
    pageSize,
    pageCount,
    total: items.length,
    rows: items.slice(start, start + pageSize),
    setPage,
    setPageSize(size: number) {
      setPageSize(size);
      setPage(1);
    },
  };
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const [draft, setDraft] = useState(String(page));

  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  function commitPage(value: string) {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 1) {
      setDraft(String(page));
      return;
    }
    onPageChange(Math.min(next, pageCount));
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-end gap-x-4 gap-y-1 bg-[#F4F4F5] px-5 py-2 text-[12px] font-bold text-[#808080]">
      <span>{total} รายการ</span>
      <label className="flex items-center gap-2">
        แสดงต่อหน้า
        <Select
          compact
          label="จำนวนต่อหน้า"
          value={String(pageSize)}
          onChange={(size) => onPageSizeChange(Number(size))}
          options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
        />
      </label>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="underline disabled:no-underline disabled:opacity-40"
      >
        ก่อนหน้า
      </button>
      <input
        aria-label="หน้า"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitPage(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitPage(draft);
        }}
        className="h-[27px] w-[25px] border border-[#D0D0D0] bg-white text-center font-bold text-[#808080]"
      />
      <span>/ {pageCount}</span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        className="underline disabled:no-underline disabled:opacity-40"
      >
        ถัดไป
      </button>
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "เลือก",
  emptyLabel = "ไม่พบรายการ",
  disabled = false,
  label,
  className = "",
  search = false,
  compact = false,
  onQuery,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  label: string;
  className?: string;
  search?: boolean;
  compact?: boolean;
  /** When set, the parent supplies options for the current query (no client filter). */
  onQuery?: (query: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const shown = onQuery ? options : options.filter((option) => matchesQuery(query, option.label));

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, compact ? 88 : 0);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow < 280 && rect.top > roomBelow ? Math.max(8, rect.top - 4 - 280) : rect.bottom + 4;
    setBox({ top, left, width });
  }

  useEffect(() => {
    if (!open) return;
    place();
    if (search) searchRef.current?.focus();
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-search-select]")) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`${compact ? "relative inline-flex" : "relative"} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setQuery("");
          onQuery?.("");
          place();
          setOpen((current) => !current);
        }}
        className={
          compact
            ? "inline-flex h-[27px] items-center gap-1 border border-[#D0D0D0] bg-white px-1 text-[12px] font-bold text-[#808080]"
            : `${inputClass} flex items-center justify-between gap-2 text-left disabled:bg-[#E7E7E7]`
        }
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-ink/20"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={compact ? 14 : 16} strokeWidth={1.75} className={`shrink-0 ${compact ? "" : "text-ink/50"}`} />
      </button>
      {open &&
        box &&
        createPortal(
          <div
            data-search-select
            style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 80 }}
            className="overflow-hidden rounded-[4px] border border-line bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            {search && (
              <div className="border-b border-frame p-2">
                <div className="relative">
                  <Search size={14} strokeWidth={1.75} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/40" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      onQuery?.(event.target.value);
                    }}
                    placeholder="ค้นหา"
                    aria-label={`ค้นหา${label}`}
                    className="h-9 w-full rounded-[4px] border border-line bg-white pl-8 pr-2 text-[14px] placeholder:text-ink/20"
                  />
                </div>
              </div>
            )}
            <ul id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
              {shown.length === 0 ? (
                <li className="px-3 py-2 text-[14px] text-ink/50">{emptyLabel}</li>
              ) : (
                shown.map((option) => {
                  const picked = option.value === value;
                  return (
                    <li key={option.value || "empty"}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={picked}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] hover:bg-pick ${picked ? "bg-pick font-bold" : ""}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {picked && <Check size={14} strokeWidth={2} className="shrink-0 text-brand" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function SearchSelect(props: Omit<Parameters<typeof Select>[0], "search" | "compact">) {
  return <Select search {...props} />;
}

export function SuggestInput({
  value,
  onChange,
  suggestions,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const shown = value.trim() ? suggestions.filter((item) => matchesQuery(value, item)).slice(0, 8) : [];

  function place() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) return;
    place();
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-suggest]")) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className}>
      <input
        ref={inputRef}
        value={value}
        aria-label={label}
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          place();
          setOpen(true);
        }}
        className={inputClass}
      />
      {open &&
        box &&
        shown.length > 0 &&
        createPortal(
          <ul
            id={listId}
            data-suggest
            role="listbox"
            style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 80 }}
            className="max-h-60 overflow-y-auto rounded-[4px] border border-line bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            {shown.map((item, index) => (
              <li key={`${item}-${index}`}>
                <button
                  type="button"
                  role="option"
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  className="flex w-full px-3 py-2 text-left text-[14px] font-normal hover:bg-pick"
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function DateField({
  value,
  onChange,
  label,
  min,
  max,
  placeholder = "เลือกวันที่",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const [cursor, setCursor] = useState(() => parseIso(value) ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 288;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow < 340 && rect.top > roomBelow ? Math.max(8, rect.top - 4 - 320) : rect.bottom + 4;
    setBox({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    place();
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-date-field]")) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const days: Array<Date | null> = [...Array(first).fill(null), ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1))];
  const today = isoDate(new Date());

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setCursor(parseIso(value) ?? parseIso(min ?? "") ?? new Date());
          place();
          setOpen((current) => !current);
        }}
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:bg-[#E7E7E7]`}
      >
        <span className={`min-w-0 truncate ${value ? "" : "text-ink/20"}`}>{value ? formatThaiDate(value) : placeholder}</span>
        <Calendar size={16} strokeWidth={1.75} className="shrink-0 text-ink/50" />
      </button>
      {open &&
        box &&
        createPortal(
          <div
            data-date-field
            style={{ position: "fixed", top: box.top, left: box.left, width: 288, zIndex: 80 }}
            className="rounded-[8px] border border-line bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="เดือนก่อน"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] hover:bg-pick"
              >
                <ChevronLeft size={16} strokeWidth={1.75} />
              </button>
              <div className="text-[14px] font-bold">{formatThaiMonth(isoDate(new Date(year, month, 1)))}</div>
              <button
                type="button"
                aria-label="เดือนถัดไป"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] hover:bg-pick"
              >
                <ChevronRight size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-[12px] font-bold text-ink/50">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                if (!day) return <div key={`pad-${index}`} />;
                const iso = isoDate(day);
                const blocked = (min != null && min !== "" && iso < min) || (max != null && max !== "" && iso > max);
                const picked = iso === value;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-[4px] text-[14px] ${
                      picked
                        ? "bg-bar font-bold text-white"
                        : blocked
                          ? "cursor-not-allowed text-ink/20"
                          : iso === today
                            ? "font-bold text-brand hover:bg-pick"
                            : "hover:bg-pick"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function FarmerSelect({
  value,
  onChange,
  allowAll = false,
}: {
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  const [found, setFound] = useState<{ value: string; label: string }[]>([]);
  const [picked, setPicked] = useState<{ value: string; label: string } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setPicked(null);
      return;
    }
    let alive = true;
    void api.getFarmer(value).then((farmer) => {
      if (alive) setPicked({ value: farmer.id, label: farmerHandle(farmer) });
    });
    return () => {
      alive = false;
    };
  }, [value]);

  function search(query: string) {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void api.listFarmersPage({ q: query.trim(), page: 1, pageSize: 20 }).then((page) => {
        setFound((page.items ?? []).map((farmer) => ({ value: farmer.id, label: farmerHandle(farmer) })));
      });
    }, 200);
  }

  const extra = picked && !found.some((item) => item.value === picked.value) ? [picked] : [];
  return (
    <SearchSelect
      label="เกษตรกร"
      value={value}
      onChange={onChange}
      placeholder={allowAll ? "ทั้งหมด" : "เลือกเกษตรกร"}
      onQuery={search}
      options={[{ value: "", label: allowAll ? "ทั้งหมด" : "เลือกเกษตรกร" }, ...extra, ...found]}
    />
  );
}
