function trim(value: string | undefined) {
  return value?.trim() ?? "";
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

/** Upstream Go API origin used by Next rewrites (server-only). */
export function getApiOrigin() {
  const raw = trim(process.env.DONA_API_URL);
  if (raw) return raw.replace(/\/$/, "");
  if (isProd()) {
    throw new Error("DONA_API_URL is required in production");
  }
  return "http://127.0.0.1:8080";
}
