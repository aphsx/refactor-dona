"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Any unknown path → send users to the mill home. */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/farmers");
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center bg-white text-[14px] text-ink/60">
      กำลังพาไปหน้าหลัก…
    </div>
  );
}
