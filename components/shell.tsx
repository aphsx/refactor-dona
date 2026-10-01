"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, ChevronDown, Factory, Layers, Map, Menu, Scale, Sprout, Users, Warehouse, type LucideIcon } from "lucide-react";
import { StoreProvider, useMill } from "@/components/store";
import { daysUntil, farmerName } from "@/lib/mill";

type NavChild = { href: string; label: string };
type NavItem = { href?: string; label: string; icon: LucideIcon; children?: NavChild[] };

const NAV: NavItem[] = [
  { href: "/", label: "รับซื้อวันนี้", icon: Scale },
  {
    label: "แผนรอบปลูก",
    icon: Sprout,
    children: [
      { href: "/plan", label: "แผนรวม" },
      { href: "/plan/members", label: "รายสมาชิก" },
    ],
  },
  { href: "/supply", label: "แผนรับข้าว", icon: CalendarDays },
  { href: "/map", label: "แผนที่แปลง", icon: Map },
  {
    label: "กลุ่ม",
    icon: Layers,
    children: [
      { href: "/groups", label: "กลุ่ม" },
      { href: "/groups/manage", label: "จัดการกลุ่ม" },
    ],
  },
  {
    label: "คู่ค้า",
    icon: Users,
    children: [
      { href: "/farmers", label: "คู่ค้า" },
      { href: "/farmers/manage", label: "จัดการสมาชิก" },
    ],
  },
  { href: "/stock", label: "ไซโล", icon: Warehouse },
  { href: "/mill", label: "ล็อตสี", icon: Factory },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <ShellFrame>{children}</ShellFrame>
    </StoreProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tickets, plots, plantings, farmers } = useMill();
  const [collapsed, setCollapsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const parent = NAV.find((item) => item.children?.some((child) => pathname === child.href));
    if (parent) setOpenMenu(parent.label);
  }, [pathname]);

  const waiting = tickets.filter((ticket) => ticket.status === "รอชั่ง");
  const duePlots = plantings
    .filter((planting) => !planting.delivered && daysUntil(planting.harvestOn) <= 7)
    .flatMap((planting) => {
      const plot = plots.find((item) => item.id === planting.plotId);
      return plot ? [{ ...planting, name: plot.name }] : [];
    });
  const notices = waiting.length + duePlots.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-ink">
      <header className="relative z-40 flex h-[85px] shrink-0 items-center justify-between bg-white px-5 shadow-[0_4px_4px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-[6px] text-sidebar"
          >
            <Menu size={24} strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/dona-logo.png" alt="Dona" className="h-11 w-11 object-contain" />
            <span className="text-[16px] font-bold tracking-tight">dona</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              aria-label="การแจ้งเตือน"
              onClick={() => {
                setBellOpen((value) => !value);
                setRoleOpen(false);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-[6px]"
            >
              <Bell size={24} strokeWidth={1.75} />
              {notices > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />}
            </button>
            {bellOpen && (
              <>
                <button type="button" aria-label="ปิดการแจ้งเตือน" className="fixed inset-0 z-40 cursor-default" onClick={() => setBellOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-[8px] border border-frame bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">สิ่งที่ต้องดู</div>
                  <ul>
                    {waiting.map((ticket) => {
                      const farmer = farmers.find((item) => item.id === ticket.farmerId);
                      return (
                        <li key={ticket.id} className="border-b border-table">
                          <Link href="/" onClick={() => setBellOpen(false)} className="block px-5 py-3 hover:bg-sub">
                            <div className="text-[14px] font-bold">คิว {ticket.queue} รอชั่ง</div>
                            <div className="mt-1 text-[12px] text-ink/70">
                              {ticket.plate} · {farmer ? farmerName(farmer) : ""}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                    {duePlots.map((plot) => (
                      <li key={plot.id} className="border-b border-table last:border-b-0">
                        <Link href="/supply" onClick={() => setBellOpen(false)} className="block px-5 py-3 hover:bg-sub">
                          <div className="text-[14px] font-bold">{plot.name} ใกล้เข้าโรงสี</div>
                          <div className="mt-1 text-[12px] text-ink/70">อีก {daysUntil(plot.harvestOn)} วัน</div>
                        </Link>
                      </li>
                    ))}
                    {notices === 0 && <li className="px-5 py-4 text-[14px] text-ink/60">ไม่มีรายการค้าง</li>}
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="relative text-right leading-tight">
            <div className="text-[12px] font-bold">สมศักดิ์ บุญมาก</div>
            <button
              type="button"
              onClick={() => {
                setRoleOpen((value) => !value);
                setBellOpen(false);
              }}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-sidebar"
            >
              ผู้จัดการโรงสี
              <ChevronDown size={14} strokeWidth={1.75} />
            </button>
            {roleOpen && (
              <>
                <button type="button" aria-label="ปิดเมนูบัญชี" className="fixed inset-0 z-40 cursor-default" onClick={() => setRoleOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-[8px] border border-frame bg-white px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  <div className="text-[12px] font-bold">สมศักดิ์ บุญมาก</div>
                  <div className="mt-1 text-[12px] text-ink/70">ผู้จัดการโรงสี</div>
                  <div className="mt-1 text-[12px] text-ink/70">dona</div>
                </div>
              </>
            )}
          </div>
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-bar text-[12px] font-bold text-white">
            สบ
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className={`flex shrink-0 flex-col border-r border-frame bg-white ${collapsed ? "w-[96px]" : "w-[316px]"}`}>
          <nav className="min-h-0 flex-1 overflow-y-auto py-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const childActive = item.children?.some((child) => pathname === child.href) ?? false;
              const active = item.href ? (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) : childActive;
              const expanded = !collapsed && openMenu === item.label;
              const rowClass = `flex h-[52px] w-full items-center gap-3 text-[14px] ${collapsed ? "justify-center px-0" : "px-4"} ${
                active ? "bg-sidebar font-bold text-white" : "font-bold text-sidebar hover:bg-slate-50"
              }`;
              const iconBox = (
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] ${active ? "bg-white/15" : "bg-sub"}`}>
                  <Icon size={24} strokeWidth={1.75} />
                </span>
              );
              if (item.children) {
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      title={item.label}
                      aria-expanded={expanded}
                      onClick={() => setOpenMenu((current) => (current === item.label ? null : item.label))}
                      className={rowClass}
                    >
                      {iconBox}
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown size={16} strokeWidth={1.75} className={expanded ? "rotate-180" : ""} />
                        </>
                      )}
                    </button>
                    {expanded &&
                      item.children.map((child) => {
                        const selected = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex h-[52px] items-center pl-16 pr-4 text-[14px] ${
                              selected ? "bg-sub font-bold text-sidebar" : "text-sidebar hover:bg-slate-50"
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                  </div>
                );
              }
              return (
                <Link key={item.href} href={item.href ?? "/"} title={item.label} className={rowClass}>
                  {iconBox}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
