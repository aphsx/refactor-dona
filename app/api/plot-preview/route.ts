import { NextRequest, NextResponse } from "next/server";
import { getApiOrigin } from "@/lib/env";

const BUCKET = "plot-previews";
const MAX_BYTES = 200_000;

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
    return NextResponse.json({ error: "ข้อมูลรูปไม่ถูกต้อง" }, { status: 400 });
  }

  const plotId = String(form.get("plotId") ?? "").trim();
  const file = form.get("file");
  if (!plotId || !(file instanceof File)) {
    return NextResponse.json({ error: "ต้องส่ง plotId และไฟล์รูป" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ไฟล์รูปใหญ่เกินไป" }, { status: 400 });
  }
  if (file.type !== "image/webp" && file.type !== "image/jpeg" && file.type !== "image/png") {
    return NextResponse.json({ error: "รองรับเฉพาะ WebP / JPEG / PNG" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
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
      "Content-Type": file.type,
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: Buffer.from(await file.arrayBuffer()),
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "อัปโหลดรูปไม่สำเร็จ" },
      { status: upload.status >= 400 ? upload.status : 502 },
    );
  }

  const previewUrl = `${supabase.url}/storage/v1/object/public/${BUCKET}/${path}`;
  const apiOrigin = getApiOrigin();
  const save = await fetch(`${apiOrigin}/api/v1/plots/${encodeURIComponent(plotId)}/preview`, {
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
