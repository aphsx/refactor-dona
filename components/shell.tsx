"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, ChevronDown, Layers, Map, Menu, Shield, Sprout, Users, type LucideIcon } from "lucide-react";
import { LoginScreen } from "@/components/login-screen";
import { StoreProvider, useMill } from "@/components/store";
import {
  clearAuthSession,
  restoreAuthSession,
  type AuthSession,
} from "@/lib/api";
import { daysUntil } from "@/lib/mill";

const HOME_PATH = "/plan";

const KNOWN_APP_PATHS = new Set([
  "/",
  "/plan",
  "/plan/members",
  "/supply",
  "/map",
  "/map/manage",
  "/groups",
  "/groups/manage",
  "/farmers",
  "/farmers/manage",
  "/permissions",
  "/permissions/people",
  "/dashboard",
]);

function isKnownAppPath(pathname: string) {
  return KNOWN_APP_PATHS.has(pathname);
}

type NavChild = { href: string; label: string };
type NavItem = { href?: string; label: string; icon: LucideIcon; children?: NavChild[] };

const NAV: NavItem[] = [
  {
    label: "แผนรอบปลูก",
    icon: Sprout,
    children: [
      { href: "/plan", label: "แผนรวม" },
      { href: "/plan/members", label: "แผนรายเกษตรกร" },
    ],
  },
  { href: "/supply", label: "แผนรับข้าว", icon: CalendarDays },
  {
    label: "แผนที่แปลง",
    icon: Map,
    children: [
      { href: "/map", label: "แผนที่แปลง" },
      { href: "/map/manage", label: "จัดการแปลง" },
    ],
  },
  {
    label: "กลุ่ม",
    icon: Layers,
    children: [
      { href: "/groups", label: "กลุ่ม" },
      { href: "/groups/manage", label: "จัดการกลุ่ม" },
    ],
  },
  {
    label: "เกษตรกร",
    icon: Users,
    children: [
      { href: "/farmers", label: "เกษตรกร" },
      { href: "/farmers/manage", label: "จัดการเกษตรกร" },
    ],
  },
  {
    label: "จัดการสิทธิ์",
    icon: Shield,
    children: [
      { href: "/permissions", label: "จัดการสิทธิ์" },
      { href: "/permissions/people", label: "รายคน" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [boot, setBoot] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const restored = restoreAuthSession();
    if (restored?.role === "mill") setSession(restored);
    else {
      clearAuthSession();
      setSession(null);
    }
    setBoot(true);
  }, []);

  useEffect(() => {
    if (!boot || !session) return;
    // Logged-in users on unknown/legacy URLs land on home.
    if (!isKnownAppPath(pathname) || pathname === "/" || pathname === "/dashboard") {
      router.replace(HOME_PATH);
    }
  }, [boot, session, pathname, router]);

  if (!boot) {
    return <div className="flex h-full items-center justify-center bg-white text-[14px] text-ink/60">กำลังโหลด…</div>;
  }

  if (!session) {
    return (
      <LoginScreen
        onSuccess={(next) => {
          setSession(next);
          // Always open the real home after login — never stay on a dead URL.
          router.replace(HOME_PATH);
        }}
      />
    );
  }

  return (
    <StoreProvider>
      <ShellFrame
        session={session}
        onLogout={() => {
          clearAuthSession();
          setSession(null);
        }}
      >
        {children}
      </ShellFrame>
    </StoreProvider>
  );
}

function ShellFrame({
  children,
  session,
  onLogout,
}: {
  children: React.ReactNode;
  session: AuthSession;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { plots, plantings, ready, loadError, reload } = useMill();
  const [collapsed, setCollapsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const displayName = session.displayName || session.username;
  const initials = displayName.slice(0, 2);

  useEffect(() => {
    const parent = NAV.find((item) => item.children?.some((child) => pathname === child.href));
    if (parent) setOpenMenu(parent.label);
  }, [pathname]);

  const duePlots = plantings
    .filter((planting) => daysUntil(planting.harvestOn) <= 7)
    .flatMap((planting) => {
      const plot = plots.find((item) => item.id === planting.plotId);
      return plot ? [{ ...planting, name: plot.name }] : [];
    });
  const notices = duePlots.length;

  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-white text-[14px] text-ink/60">กำลังโหลด…</div>;
  }
  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-[16px] font-bold text-danger">โหลดข้อมูลไม่สำเร็จ</p>
        <p className="text-[14px] text-ink/70">{loadError}</p>
        <p className="text-[13px] text-ink/50">ตรวจว่า API รันที่ :8080</p>
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            void reload().finally(() => setRetrying(false));
          }}
          className="mt-2 inline-flex h-10 items-center rounded-[6px] bg-brand px-4 text-[14px] font-bold text-white disabled:bg-[#D0D0D0]"
        >
          {retrying ? "กำลังลองใหม่…" : "ลองเชื่อมใหม่"}
        </button>
      </div>
    );
  }

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
            <div className="text-[12px] font-bold">{displayName}</div>
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
                  <div className="text-[12px] font-bold">{displayName}</div>
                  <div className="mt-1 text-[12px] text-ink/70">@{session.username}</div>
                  <div className="mt-1 text-[12px] text-ink/70">ผู้จัดการโรงสี</div>
                  <button
                    type="button"
                    onClick={() => {
                      setRoleOpen(false);
                      onLogout();
                    }}
                    className="mt-3 text-[12px] font-bold text-danger"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-bar text-[12px] font-bold text-white">
            {initials}
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
