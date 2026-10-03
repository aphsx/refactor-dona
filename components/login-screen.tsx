"use client";

import { useState } from "react";
import { apiLogin, apiMessage, clearAuthSession, type AuthSession } from "@/lib/api";
import { inputClass } from "@/components/ui";

export function LoginScreen({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-white px-6">
      <form
        className="w-full max-w-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            setBusy(true);
            setError("");
            try {
              const session = await apiLogin(username.trim(), password);
              if (session.role !== "mill") {
                clearAuthSession();
                setError("แอปนี้สำหรับผู้ใช้โรงสีเท่านั้น");
                return;
              }
              onSuccess(session);
            } catch (err) {
              setError(apiMessage(err));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <div className="mb-8 flex items-center gap-3">
          <img src="/dona-logo.png" alt="Dona" className="h-12 w-12 object-contain" />
          <div>
            <div className="text-[20px] font-bold tracking-tight">dona</div>
            <div className="text-[13px] text-ink/60">เข้าสู่ระบบโรงสี</div>
          </div>
        </div>

        <label className="block text-[14px] font-bold leading-[1.4]">
          ชื่อผู้ใช้
          <input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>

        <label className="mt-4 block text-[14px] font-bold leading-[1.4]">
          รหัสผ่าน
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>

        {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-[6px] bg-brand text-[14px] font-bold text-white disabled:bg-[#D0D0D0]"
        >
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
