import { NextRequest, NextResponse } from "next/server";

const BUCKET = "announcement-images";
/** LINE Messaging image practical limit for this product surface. */
const MAX_BYTES = 5 * 1024 * 1024;

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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ต้องส่งไฟล์รูป" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ไฟล์รูปต้องไม่เกิน 5 MB" }, { status: 400 });
  }
  // LINE image messages accept JPEG/PNG only (client compresses to JPEG).
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    return NextResponse.json({ error: "รองรับเฉพาะ JPEG / PNG" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    let message = "อัปโหลดรูปไม่สำเร็จ";
    if (detail.includes("Bucket not found") || detail.includes("NoSuchBucket")) {
      message = "ยังไม่มี bucket announcement-images ใน Supabase (ต้องเป็น public)";
    } else if (detail.includes("row-level security") || detail.includes("AccessDenied")) {
      message = "อัปโหลดรูปไม่ได้ — ตรวจ storage policy ของ bucket announcement-images";
    } else if (detail) {
      message = detail.slice(0, 300);
    }
    return NextResponse.json({ error: message }, { status: upload.status >= 400 ? upload.status : 502 });
  }

  return NextResponse.json({
    imageUrl: `${supabase.url}/storage/v1/object/public/${BUCKET}/${path}`,
    imageName: file.name || path,
  });
}
