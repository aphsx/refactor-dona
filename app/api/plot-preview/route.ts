import { NextRequest, NextResponse } from "next/server";
import { getApiOrigin } from "@/lib/env";

/** Public Supabase bucket for plot map thumbnails (not the "dona" product name). */
const BUCKET = "plot-previews";
const MAX_BYTES = 200_000;
const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png"]);

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY ยังไม่ได้ตั้งค่า");
  }
  return { url, key };
}

function sniffMime(bytes: Uint8Array, fallback: string, filename: string) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (ALLOWED.has(fallback)) return fallback;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "";
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "ข้อมูลรูปไม่ถูกต้อง" }, { status: 400 });
  }

  const plotId = String(form.get("plotId") ?? "").trim();
  const file = form.get("file");
  if (!plotId || !(file instanceof Blob)) {
    return NextResponse.json({ error: "ต้องส่ง plotId และไฟล์รูป" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "ไฟล์รูปว่าง" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `ไฟล์รูปใหญ่เกินไป (สูงสุด ${Math.round(MAX_BYTES / 1024)}KB)` },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = file instanceof File ? file.name : "preview.webp";
  const mime = sniffMime(bytes, file.type || "", filename);
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "รองรับเฉพาะ WebP / JPEG / PNG" }, { status: 400 });
  }

  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
  const path = `${plotId}/preview-${Date.now()}.${ext}`;

  let supabase: { url: string; key: string };
  try {
    supabase = supabaseConfig();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ตั้งค่า Storage ไม่ครบ" },
      { status: 500 },
    );
  }

  const upload = await fetch(`${supabase.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      "Content-Type": mime,
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: Buffer.from(bytes),
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    let message = "อัปโหลดรูปไม่สำเร็จ";
    if (detail.includes("Bucket not found") || detail.includes("NoSuchBucket")) {
      message = "ยังไม่มี bucket plot-previews ใน Supabase (ต้องเป็น public)";
    } else if (detail.includes("row-level security") || detail.includes("AccessDenied")) {
      message = "อัปโหลดไม่ได้ — ตรวจ storage policy ของ bucket plot-previews";
    } else if (detail.includes("EntityTooLarge") || detail.includes("Payload too large")) {
      message = "ไฟล์ใหญ่เกินขีดจำกัดของ Storage";
    } else if (detail) {
      message = detail.slice(0, 300);
    }
    return NextResponse.json(
      { error: message },
      { status: upload.status >= 400 ? upload.status : 502 },
    );
  }

  const previewUrl = `${supabase.url}/storage/v1/object/public/${BUCKET}/${path}`;
  const apiOrigin = getApiOrigin();
  const save = await fetch(`${apiOrigin}/api/v1/platform/plots/${encodeURIComponent(plotId)}/preview`, {
    method: "PUT",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ previewUrl }),
  });
  const body = await save.json().catch(() => ({}));
  if (!save.ok) {
    return NextResponse.json(
      { error: typeof body?.error === "string" ? body.error : "บันทึก URL รูปไม่สำเร็จ" },
      { status: save.status },
    );
  }

  return NextResponse.json(body);
}
