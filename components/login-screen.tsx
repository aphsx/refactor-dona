"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";
import { apiLogin, apiMessage, clearAuthSession, type AuthSession } from "@/lib/api";

const brandDark = "#24586C";
const brandPrimary = "#50AB6D";
const brandButton = "#24586C";
const brandButtonHover = "#1C4A5C";

export function LoginScreen({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordHidden, setPasswordHidden] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, #fff6d6 0%, #f4faf7 40%, #e8f2ef 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-50"
        style={{
          background: "linear-gradient(180deg, rgba(80,171,109,0.16), transparent)",
        }}
      />

      {/* Extra bottom padding offsets logo height so the block sits optically higher */}
      <div className="flex min-h-full items-center justify-center px-6 pb-28 pt-10">
      <form
        className="login-rise relative w-full max-w-[360px]"
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
        <div className="mb-8 text-center">
          <img
            src="/logo.png"
            alt="DONA TECHNOLOGY"
            className="mx-auto h-14 w-auto object-contain drop-shadow-sm"
          />
          <p className="mt-4 text-[15px]" style={{ color: `${brandDark}99` }}>
            เข้าสู่ระบบโรงสี
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: brandDark }}>
              ชื่อผู้ใช้
            </span>
            <span className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 ring-1 ring-black/5 backdrop-blur-sm transition-[box-shadow,ring-color] focus-within:ring-[#50AB6D]/40 focus-within:shadow-[0_0_0_4px_rgba(80,171,109,0.14)]">
              <UserRound size={20} strokeWidth={1.75} style={{ color: `${brandPrimary}B3` }} />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ชื่อผู้ใช้"
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold" style={{ color: brandDark }}>
              รหัสผ่าน
            </span>
            <span className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 ring-1 ring-black/5 backdrop-blur-sm transition-[box-shadow,ring-color] focus-within:ring-[#50AB6D]/40 focus-within:shadow-[0_0_0_4px_rgba(80,171,109,0.14)]">
              <Lock size={20} strokeWidth={1.75} style={{ color: `${brandPrimary}B3` }} />
              <input
                type={passwordHidden ? "password" : "text"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="รหัสผ่าน"
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setPasswordHidden((current) => !current)}
                className="shrink-0 p-1"
                aria-label={passwordHidden ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน"}
                style={{ color: `${brandPrimary}99` }}
              >
                {passwordHidden ? (
                  <EyeOff size={20} strokeWidth={1.75} />
                ) : (
                  <Eye size={20} strokeWidth={1.75} />
                )}
              </button>
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-4 text-center text-[13px] font-semibold text-red-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl text-[15px] font-bold text-white transition-[transform,opacity,background-color] hover:brightness-95 active:scale-[0.99] disabled:opacity-50"
          style={{ backgroundColor: busy ? brandButtonHover : brandButton }}
        >
          {busy ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "เข้าสู่ระบบ"
          )}
        </button>
      </form>
      </div>
    </div>
  );
}
