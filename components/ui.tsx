"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMill } from "@/components/store";
import { farmerName } from "@/lib/mill";

export const inputClass =
  "h-10 w-full rounded-[4px] border border-line bg-white px-3 text-[14px] text-ink placeholder:text-ink/20";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-brand px-4 text-[14px] font-bold text-white hover:bg-brand-hover disabled:bg-[#D0D0D0] ${className}`}
    >
      {children}
    </button>
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
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border-2 border-brand bg-white px-4 text-[14px] font-bold text-brand ${className}`}
    >
      {children}
    </button>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[8px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
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
      className={`rounded-t-[6px] px-4 font-bold ${active ? "h-10 bg-bar text-white" : "h-9 bg-table text-ink"}`}
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
        <select
          aria-label="จำนวนต่อหน้า"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-[27px] border border-[#D0D0D0] bg-white px-1 font-bold text-[#808080] underline"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
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

export function FarmerSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { farmers } = useMill();
  return (
    <select aria-label="คู่ค้า" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      <option value="">เลือกคู่ค้า</option>
      {farmers.map((farmer) => (
        <option key={farmer.id} value={farmer.id}>
          {farmerName(farmer)} · {farmer.variety}
        </option>
      ))}
    </select>
  );
}
