"use client";

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
        โรงสี
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

export function CountBar({ count }: { count: number }) {
  return (
    <div className="flex h-11 items-center justify-end bg-[#F4F4F5] px-5 text-[12px] font-bold text-[#808080]">
      {count} รายการ
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
