import imageCompression from "browser-image-compression";

/** Mild client-side compress for announcement images (keep quality high).
 * Plot/avatar previews use much smaller sizes (e.g. 256px) — do not match that here.
 * LINE image messages accept JPEG/PNG only (not WebP).
 */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.86;
const TARGET_MAX_MB = 1.8;

/** Resize longest edge to MAX_EDGE and encode JPEG — smaller file, still sharp. */
export async function compressAnnouncementImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  // Already small JPEG under ~1.2MB — skip re-encode to avoid generational loss
  // when longest edge is already within MAX_EDGE (library would still re-encode).
  if (file.type === "image/jpeg" && file.size <= 1_200_000) {
    try {
      const bitmap = await createImageBitmap(file);
      const longest = Math.max(bitmap.width, bitmap.height);
      bitmap.close();
      if (longest <= MAX_EDGE) return file;
    } catch {
      // Fall through to compress.
    }
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_MAX_MB,
      maxWidthOrHeight: MAX_EDGE,
      fileType: "image/jpeg",
      initialQuality: JPEG_QUALITY,
      useWebWorker: true,
    });
    const base = file.name.replace(/\.[^.]+$/, "") || "announcement";
    return new File([compressed], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
