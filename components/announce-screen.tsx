"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Eye, FileText, ImagePlus, Megaphone, Save, Send, X } from "lucide-react";
import {
  ConfirmAlert,
  DateField,
  Dialog,
  Glyph,
  PageHeader,
  Pagination,
  PrimaryButton,
  ResultAlert,
  SecondaryButton,
  StatusTab,
  TableScroll,
  inputClass,
  tableClass,
  usePagination,
} from "@/components/ui";
import {
  apiMessage,
  cancelAnnouncement,
  createAnnouncement,
  listAnnouncements,
  type Announcement,
  type AnnouncementStatus,
} from "@/lib/api";

const MAX_MESSAGE = 5000;
const MAX_TITLE = 100;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type SendMode = "now" | "schedule";
type Priority = "normal" | "urgent";
type HistoryFilter = "all" | AnnouncementStatus;

type ImageDraft = {
  name: string;
  size: number;
  previewUrl: string;
};

type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string };

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function nextHourTime() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status: AnnouncementStatus) {
  if (status === "sent") return "ส่งแล้ว";
  if (status === "scheduled") return "ตั้งเวลา";
  if (status === "cancelled") return "ยกเลิกคิว";
  if (status === "failed") return "ส่งไม่สำเร็จ";
  return "ร่าง";
}

function priorityLabel(priority: string) {
  return priority === "urgent" ? "ด่วน" : "ปกติ";
}

function contentKind(item: Announcement) {
  const parts: string[] = [];
  if (item.title || item.message) parts.push("ข้อความ");
  if (item.imageName || item.imageUrl) parts.push("รูป");
  if (item.linkUrl) parts.push("ลิงก์");
  return parts.length ? parts.join(" + ") : "—";
}

function parseSchedule(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildLineBody(title: string, message: string, linkUrl: string, priority: Priority) {
  const chunks: string[] = [];
  if (priority === "urgent") chunks.push("[ด่วน]");
  if (title) chunks.push(title);
  if (message) chunks.push(message);
  if (linkUrl) chunks.push(linkUrl);
  return chunks.join("\n\n");
}

export function AnnounceScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [image, setImage] = useState<ImageDraft | null>(null);
  const [priority, setPriority] = useState<Priority>("normal");
  const [mode, setMode] = useState<SendMode>("now");
  const [scheduleDate, setScheduleDate] = useState(todayIso);
  const [scheduleTime, setScheduleTime] = useState(nextHourTime);
  const [items, setItems] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const trimmedTitle = title.trim();
  const trimmedMessage = message.trim();
  const trimmedLink = linkUrl.trim();
  const lineBody = buildLineBody(trimmedTitle, trimmedMessage, trimmedLink, priority);
  const remaining = MAX_MESSAGE - [...lineBody].length;
  const hasContent = Boolean(trimmedTitle || trimmedMessage || trimmedLink || image);
  const canPublish = hasContent && remaining >= 0 && (!trimmedLink || isHttpUrl(trimmedLink));

  const filtered = useMemo(() => {
    const rows = filter === "all" ? items : items.filter((item) => item.status === filter);
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, filter]);
  const page = usePagination(filtered, filter);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAnnouncements();
      setItems(rows);
    } catch (err) {
      setNotice({ tone: "error", message: apiMessage(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function clearImage() {
    setImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function clearForm() {
    setTitle("");
    setMessage("");
    setLinkUrl("");
    clearImage();
    setPriority("normal");
    setMode("now");
    setScheduleDate(todayIso());
    setScheduleTime(nextHourTime());
  }

  function onPickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice({ tone: "error", message: "แนบได้เฉพาะไฟล์รูปภาพ" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setNotice({ tone: "error", message: "รูปต้องไม่เกิน 10 MB" });
      return;
    }
    clearImage();
    setImage({
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function validateForPublish(): string | null {
    if (!hasContent) return "กรอกหัวข้อ ข้อความ รูป หรือลิงก์อย่างน้อยหนึ่งอย่าง";
    if (remaining < 0) return `ข้อความรวมยาวเกิน ${MAX_MESSAGE.toLocaleString("th-TH")} ตัวอักษร`;
    if (trimmedLink && !isHttpUrl(trimmedLink)) return "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://";
    return null;
  }

  function resolveSchedule(): { scheduledAt?: string; error: string | null } {
    if (mode !== "schedule") return { error: null };
    const when = parseSchedule(scheduleDate, scheduleTime);
    if (!when) return { error: "เลือกวันและเวลาให้ครบ" };
    if (when.getTime() <= Date.now()) return { error: "เวลาที่ตั้งต้องเป็นอนาคต" };
    return { scheduledAt: when.toISOString(), error: null };
  }

  async function submit(nextMode: "draft" | "now" | "schedule") {
    const error = validateForPublish();
    if (error) {
      setNotice({ tone: "error", message: error });
      return;
    }
    let scheduledAt: string | undefined;
    if (nextMode === "schedule") {
      const schedule = resolveSchedule();
      if (schedule.error) {
        setNotice({ tone: "error", message: schedule.error });
        return;
      }
      scheduledAt = schedule.scheduledAt;
    }

    setBusy(true);
    try {
      await createAnnouncement({
        title: trimmedTitle,
        message: trimmedMessage,
        linkUrl: trimmedLink,
        imageName: image?.name ?? "",
        // Local file preview is not a public HTTPS URL — LINE image send needs hosting later.
        imageUrl: "",
        priority,
        mode: nextMode,
        scheduledAt,
      });
      clearForm();
      await refresh();
      setNotice({
        tone: "success",
        message:
          nextMode === "draft"
            ? "บันทึกร่างแล้ว"
            : nextMode === "schedule"
              ? "ตั้งเวลาส่งแล้ว — ระบบจะส่งเข้า LINE เมื่อถึงเวลา"
              : "ส่งประกาศเข้า LINE OA แล้ว",
      });
    } catch (err) {
      await refresh();
      setNotice({ tone: "error", message: apiMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function requestPublish() {
    const error = validateForPublish();
    if (error) {
      setNotice({ tone: "error", message: error });
      return;
    }
    const schedule = resolveSchedule();
    if (mode === "schedule" && schedule.error) {
      setNotice({ tone: "error", message: schedule.error });
      return;
    }

    const confirmMessage =
      mode === "schedule"
        ? `ยืนยันตั้งเวลาส่งประกาศ ${formatWhen(schedule.scheduledAt!)} ไปยังผู้ติดตาม LINE OA?`
        : "ยืนยันส่งประกาศไปยังผู้ติดตาม LINE OA ทันที?";

    setNotice({
      tone: "confirm",
      message: confirmMessage,
      accept: () => submit(mode === "schedule" ? "schedule" : "now"),
    });
  }

  function cancelScheduled(id: string) {
    setNotice({
      tone: "confirm",
      message: "ยืนยันยกเลิกคิวประกาศนี้?",
      accept: async () => {
        setBusy(true);
        try {
          await cancelAnnouncement(id);
          await refresh();
          setNotice({ tone: "success", message: "ยกเลิกคิวแล้ว" });
        } catch (err) {
          setNotice({ tone: "error", message: apiMessage(err) });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="ประกาศ LINE" />

      <div className="mb-6 rounded-[8px] border border-frame bg-[#F5F9FE] px-6 py-4 text-[14px] leading-[1.5] text-ink/80">
        ส่งผ่าน <span className="font-bold text-ink">LINE Official Account</span> ถึงทุกคนที่แอดเพื่อน OA แล้ว · ผู้รับ: ทั้ง OA ·
        ช่องทาง: LINE
        {image ? " · รูปในฟอร์มใช้พรีวิวเท่านั้น (ยังไม่อัปโหลดส่ง LINE)" : null}
      </div>

      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">เขียนประกาศ</div>
        <form
          className="grid gap-5 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            requestPublish();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-4">
              <label className="block text-[14px] font-bold leading-[1.4]">
                หัวข้อ
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE))}
                  maxLength={MAX_TITLE}
                  placeholder="เช่น แจ้งเปิดรับข้าวเปลือก"
                  className={`${inputClass} mt-1`}
                />
                <span className="mt-1 block text-[12px] font-normal text-ink/45">
                  {trimmedTitle.length}/{MAX_TITLE}
                </span>
              </label>

              <label className="block text-[14px] font-bold leading-[1.4]">
                ข้อความ
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  placeholder="รายละเอียดประกาศจากโรงสี…"
                  className={`${inputClass} mt-1 h-auto min-h-[180px] resize-y py-3 leading-[1.5]`}
                />
              </label>

              <label className="block text-[14px] font-bold leading-[1.4]">
                ลิงก์ (ถ้ามี)
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://…"
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>

            <div className="grid gap-4 content-start">
              <div className="text-[14px] font-bold leading-[1.4]">
                รูปประกอบ
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => onPickImage(event.target.files?.[0])}
                />
                {image ? (
                  <div className="mt-1 overflow-hidden rounded-[8px] border border-frame">
                    <img src={image.previewUrl} alt="" className="h-40 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-normal text-ink/70">
                      <span className="truncate">{image.name}</span>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="inline-flex items-center gap-1 font-bold text-brand hover:underline"
                      >
                        <X size={14} strokeWidth={2} />
                        ลบ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-1 flex h-40 w-full flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-line bg-white text-[13px] font-normal text-ink/55 transition-colors hover:bg-pick"
                  >
                    <ImagePlus size={22} strokeWidth={1.75} />
                    แนบรูป JPEG / PNG
                    <span className="text-[12px]">พรีวิวอย่างเดียว (ยังไม่ส่ง LINE)</span>
                  </button>
                )}
              </div>

              <fieldset className="grid gap-2">
                <legend className="text-[14px] font-bold leading-[1.4]">ความสำคัญ</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-normal">
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === "normal"}
                      onChange={() => setPriority("normal")}
                      className="h-4 w-4 accent-ink"
                    />
                    ปกติ
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-normal">
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === "urgent"}
                      onChange={() => setPriority("urgent")}
                      className="h-4 w-4 accent-ink"
                    />
                    ด่วน
                  </label>
                </div>
              </fieldset>

              <div className="rounded-[8px] border border-frame bg-table px-4 py-3 text-[13px] font-normal leading-[1.5] text-ink/70">
                <div className="font-bold text-ink">ผู้รับ</div>
                ทุกคนที่แอดเพื่อน LINE OA
              </div>
            </div>
          </div>

          <fieldset className="grid gap-3 border-t border-frame pt-5">
            <legend className="px-1 text-[14px] font-bold leading-[1.4]">เวลาส่ง</legend>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-normal">
                <input
                  type="radio"
                  name="send-mode"
                  checked={mode === "now"}
                  onChange={() => setMode("now")}
                  className="h-4 w-4 accent-ink"
                />
                ส่งทันที
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-normal">
                <input
                  type="radio"
                  name="send-mode"
                  checked={mode === "schedule"}
                  onChange={() => setMode("schedule")}
                  className="h-4 w-4 accent-ink"
                />
                ตั้งเวลา
              </label>
            </div>
            {mode === "schedule" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
                <label className="block text-[14px] font-bold leading-[1.4]">
                  วันที่
                  <DateField
                    label="วันที่ส่ง"
                    className="mt-1"
                    value={scheduleDate}
                    min={todayIso()}
                    onChange={setScheduleDate}
                  />
                </label>
                <label className="block text-[14px] font-bold leading-[1.4]">
                  เวลา
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-frame pt-5">
            <p className={`text-[13px] ${remaining < 100 ? "font-bold text-danger" : "text-ink/50"}`}>
              ข้อความรวมใน LINE เหลือ {remaining.toLocaleString("th-TH")} ตัวอักษร
            </p>
            <div className="flex flex-wrap gap-3">
              <SecondaryButton type="button" disabled={!hasContent || busy} onClick={clearForm}>
                ล้าง
              </SecondaryButton>
              <SecondaryButton type="button" disabled={!hasContent || busy} onClick={() => setPreviewOpen(true)}>
                <Glyph icon={Eye} />
                พรีวิว
              </SecondaryButton>
              <SecondaryButton type="button" disabled={!canPublish || busy} onClick={() => void submit("draft")}>
                <Glyph icon={Save} />
                บันทึกร่าง
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={!canPublish || busy}>
                <Glyph icon={mode === "schedule" ? Clock : Send} />
                {busy ? "กำลังส่ง…" : mode === "schedule" ? "ตั้งเวลาส่ง" : "ส่งประกาศ"}
              </PrimaryButton>
            </div>
          </div>
        </form>
      </div>

      <div className="mb-0 flex flex-wrap items-end gap-2">
        <StatusTab label="ทั้งหมด" active={filter === "all"} onClick={() => setFilter("all")} />
        <StatusTab label="ร่าง" active={filter === "draft"} onClick={() => setFilter("draft")} />
        <StatusTab label="ตั้งเวลา" active={filter === "scheduled"} onClick={() => setFilter("scheduled")} />
        <StatusTab label="ส่งแล้ว" active={filter === "sent"} onClick={() => setFilter("sent")} />
        <StatusTab label="ล้มเหลว" active={filter === "failed"} onClick={() => setFilter("failed")} />
        <StatusTab label="ยกเลิก" active={filter === "cancelled"} onClick={() => setFilter("cancelled")} />
      </div>

      <div className="overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
          <span className="inline-flex items-center gap-2">
            <Megaphone size={18} strokeWidth={1.75} aria-hidden />
            ประวัติประกาศ
          </span>
          <span className="text-[14px] font-normal">
            {loading ? "กำลังโหลด…" : `${filtered.length} รายการ`}
          </span>
        </div>
        <TableScroll>
          <table className={tableClass}>
            <thead className="bg-table">
              <tr>
                <th className="px-5 py-3 font-bold">สร้างเมื่อ</th>
                <th className="px-5 py-3 font-bold">เวลาส่ง</th>
                <th className="min-w-[220px] px-5 py-3 font-bold">หัวข้อ / ข้อความ</th>
                <th className="px-5 py-3 font-bold">ประเภท</th>
                <th className="px-5 py-3 font-bold">ความสำคัญ</th>
                <th className="px-5 py-3 font-bold">สถานะ</th>
                <th className="w-0 whitespace-nowrap px-5 py-3 font-bold">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {!loading && page.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-ink/60">
                    ยังไม่มีประกาศ
                  </td>
                </tr>
              )}
              {page.rows.map((item, index) => (
                <tr key={item.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                  <td className="px-5 py-3 align-top">{formatWhen(item.createdAt)}</td>
                  <td className="px-5 py-3 align-top">
                    {item.scheduledAt
                      ? formatWhen(item.scheduledAt)
                      : item.status === "draft"
                        ? "—"
                        : item.sentAt
                          ? formatWhen(item.sentAt)
                          : "ทันที"}
                  </td>
                  <td className="max-w-[360px] px-5 py-3 align-top">
                    <div className="font-bold">{item.title || "—"}</div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-ink/75">
                      {item.message || (item.linkUrl ? item.linkUrl : "—")}
                    </div>
                    {item.imageName && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-ink/55">
                        <FileText size={12} strokeWidth={1.75} />
                        {item.imageName}
                      </div>
                    )}
                    {item.errorMessage && (
                      <div className="mt-2 text-[12px] text-danger">{item.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top">{contentKind(item)}</td>
                  <td className="px-5 py-3 align-top">
                    <span className={item.priority === "urgent" ? "font-bold text-danger" : ""}>
                      {priorityLabel(item.priority)}
                    </span>
                  </td>
                  <td className="px-5 py-3 align-top text-ink/70">{statusLabel(item.status)}</td>
                  <td className="w-0 whitespace-nowrap px-5 py-3 align-top">
                    {item.status === "scheduled" ? (
                      <PrimaryButton type="button" compact disabled={busy} onClick={() => cancelScheduled(item.id)}>
                        ยกเลิกคิว
                      </PrimaryButton>
                    ) : (
                      <span className="text-ink/35">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {filtered.length > 0 && (
          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pageSize={page.pageSize}
            total={page.total}
            onPageChange={page.setPage}
            onPageSizeChange={page.setPageSize}
          />
        )}
      </div>

      {previewOpen && (
        <Dialog title="พรีวิวใน LINE" onClose={() => setPreviewOpen(false)}>
          <div className="rounded-[8px] bg-[#747F8D] p-4">
            <div className="ml-auto max-w-[280px] overflow-hidden rounded-[12px] bg-white shadow-sm">
              {image && <img src={image.previewUrl} alt="" className="max-h-44 w-full object-cover" />}
              <div className="space-y-2 px-3 py-3 text-[14px] leading-[1.45] text-ink">
                {priority === "urgent" && <div className="font-bold text-danger">[ด่วน]</div>}
                {trimmedTitle && <div className="font-bold">{trimmedTitle}</div>}
                {trimmedMessage && <div className="whitespace-pre-wrap break-words">{trimmedMessage}</div>}
                {trimmedLink && (
                  <a href={trimmedLink} className="break-all text-link underline" target="_blank" rel="noreferrer">
                    {trimmedLink}
                  </a>
                )}
                {!trimmedTitle && !trimmedMessage && !trimmedLink && !image && (
                  <div className="text-ink/50">ยังไม่มีเนื้อหา</div>
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-[12px] text-white/80">
              {mode === "schedule" ? `ตั้งส่ง ${scheduleDate} ${scheduleTime}` : "ส่งทันที"} · ผู้รับทั้ง OA
            </p>
          </div>
          <div className="mt-5 flex justify-end">
            <PrimaryButton type="button" onClick={() => setPreviewOpen(false)}>
              ปิด
            </PrimaryButton>
          </div>
        </Dialog>
      )}

      {notice?.tone === "confirm" && (
        <ConfirmAlert
          message={notice.message}
          onCancel={() => setNotice(null)}
          onConfirm={notice.accept}
        />
      )}
      {(notice?.tone === "success" || notice?.tone === "error") && (
        <ResultAlert kind={notice.tone} message={notice.message} onClose={() => setNotice(null)} />
      )}
    </div>
  );
}
