import { NextRequest, NextResponse } from "next/server";
import { getApiOrigin } from "@/lib/env";

/**
 * Public bucket for loan application documents:
 *   loan-documents/{applicationId}/{kindId}-*.jpg
 * (Profile avatars stay in the small `avatars` bucket — 100KB limit.)
 */
const BUCKET = "loan-documents";
const MAX_BYTES = 8_000_000;

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY ยังไม่ได้ตั้งค่า");
  }
  return { url, key };
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
    return NextResponse.json({ error: "ข้อมูลไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const applicationId = String(form.get("applicationId") ?? "").trim();
  const kindIdRaw = String(form.get("kindId") ?? "").trim();
  const kindId = Number(kindIdRaw);
  const file = form.get("file");

  if (!applicationId || !Number.isInteger(kindId) || kindId < 1 || !(file instanceof File)) {
    return NextResponse.json({ error: "ต้องส่ง applicationId, kindId และไฟล์" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกินไป (สูงสุด 8MB)" }, { status: 400 });
  }

  // Client compresses PDF → JPEG; Storage allows image MIME only.
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะรูป JPEG / PNG / WebP (PDF จะถูกแปลงเป็นรูปก่อนอัปโหลด)" },
      { status: 400 },
    );
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const path = `${applicationId}/${kindId}-${Date.now()}.${ext}`;

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
      "Content-Type": file.type,
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    let message = "อัปโหลดเอกสารไม่สำเร็จ";
    if (detail.includes("Bucket not found") || detail.includes("NoSuchBucket")) {
      message = "ยังไม่มี bucket loan-documents ใน Supabase (ต้องเป็น public)";
    } else if (detail.includes("row-level security") || detail.includes("AccessDenied")) {
      message = "อัปโหลดไม่ได้ — ตรวจ storage policy ของ bucket loan-documents";
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

  const storagePath = `${supabase.url}/storage/v1/object/public/${BUCKET}/${path}`;
  const apiOrigin = getApiOrigin();
  const save = await fetch(
    `${apiOrigin}/api/v1/loans/applications/${encodeURIComponent(applicationId)}/documents/${kindId}`,
    {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storagePath }),
    },
  );
  const body = await save.json().catch(() => ({}));
  if (!save.ok) {
    return NextResponse.json(
      { error: typeof body?.error === "string" ? body.error : "บันทึกเอกสารไม่สำเร็จ" },
      { status: save.status },
    );
  }

  return NextResponse.json(body);
}
