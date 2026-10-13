"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthSession } from "@/lib/api";

/** Mill permission-management screens: admin only (future roles can extend this gate). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const session = getAuthSession();
    if (!session?.isAdmin) {
      router.replace("/farmers");
      return;
    }
    setOk(true);
  }, [router]);

  if (!ok) {
    return <div className="flex h-full items-center justify-center bg-white text-[14px] text-ink/60">กำลังโหลด…</div>;
  }
  return children;
}
