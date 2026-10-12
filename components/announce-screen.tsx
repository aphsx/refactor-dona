"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, FileText, ImagePlus, LayoutTemplate, Link2, Megaphone, Save, Send, Type, X } from "lucide-react";
import { CanAdd, CanDelete, CanRead } from "@/components/can";
import {
  ConfirmAlert,
  DateField,
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
} from "@/components/ui";
import {
  ANNOUNCEMENT_PRIORITY,
  ANNOUNCEMENT_STATUS,
  apiMessage,
  cancelAnnouncement,
  createAnnouncement,
  listAnnouncementPriorities,
  listAnnouncementsPage,
  listAnnouncementStatuses,
  sendAnnouncementDraft,
  uploadAnnouncementImage,
  type Announcement,
  type AnnouncementLookup,
} from "@/lib/api";
import { compressAnnouncementImage } from "@/lib/compress-image";

const MAX_MESSAGE = 5000;
const MAX_TITLE = 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BUTTON = 20;

/** Card layout presets — mirrors LINE OA / Megaphone / broadcast composer patterns. */
type CardLayout = "card" | "text_button" | "text";

type SendMode = "now" | "schedule";
type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string };

type ImageDraft = {
  file: File;
  name: string;
  previewUrl: string;
};

type ContentStarter = {
  id: string;
  label: string;
  title: string;
  message: string;
  layout: CardLayout;
  priorityId: number;
  buttonLabel: string;
};

const LAYOUTS: {
  id: CardLayout;
  title: string;
  desc: string;
  icon: typeof Type;
}[] = [
  {
    id: "card",
    title: "การ์ดเต็ม",
    desc: "รูป + ข้อความ + ปุ่มกด",
    icon: LayoutTemplate,
  },
  {
    id: "text_button",
    title: "ข้อความ + ปุ่ม",
    desc: "ไม่มีรูป มีปุ่มเปิดลิงก์",
    icon: Link2,
  },
  {
    id: "text",
    title: "ข้อความอย่างเดียว",
    desc: "สั้นๆ ไม่มีปุ่ม",
    icon: Type,
  },
];

const STARTERS: ContentStarter[] = [
  {
    id: "general",
    label: "ประกาศทั่วไป",
    title: "ประกาศจากโรงสี",
    message: "",
    layout: "card",
    priorityId: ANNOUNCEMENT_PRIORITY.normal,
    buttonLabel: "เปิดลิงก์",
  },
  {
    id: "receive",
    label: "เปิดรับข้าว",
    title: "แจ้งเปิดรับข้าวเปลือก",
    message: "โรงสีเปิดรับข้าวเปลือกตามรายละเอียดด้านล่าง กรุณาตรวจสอบก่อนนำส่ง",
    layout: "card",
    priorityId: ANNOUNCEMENT_PRIORITY.normal,
    buttonLabel: "ดูรายละเอียด",
  },
  {
    id: "urgent",
    label: "ด่วน",
    title: "ประกาศด่วน",
    message: "",
    layout: "text_button",
    priorityId: ANNOUNCEMENT_PRIORITY.urgent,
    buttonLabel: "อ่านเพิ่มเติม",
  },
  {
    id: "closed",
    label: "ปิดปรับปรุง",
    title: "แจ้งปิดปรับปรุงชั่วคราว",
    message: "โรงสีจะปิดปรับปรุงในวันและเวลาที่ระบุ ขออภัยในความไม่สะดวก",
    layout: "text",
    priorityId: ANNOUNCEMENT_PRIORITY.normal,
    buttonLabel: "เปิดลิงก์",
  },
];

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

function buildLineBody(title: string, message: string, linkUrl: string, priorityId: number) {
  const chunks: string[] = [];
  if (priorityId === ANNOUNCEMENT_PRIORITY.urgent) chunks.push("[ด่วน]");
  if (title) chunks.push(title);
  if (message) chunks.push(message);
  if (linkUrl) chunks.push(linkUrl);
  return chunks.join("\n\n");
}

function LineCardPreview({
  title,
  message,
  linkUrl,
  buttonLabel,
  priorityId,
  imageUrl,
  showImage,
  showButton,
}: {
  title: string;
  message: string;
  linkUrl: string;
  buttonLabel: string;
  priorityId: number;
  imageUrl: string | null;
  showImage: boolean;
  showButton: boolean;
}) {
  return (
    <div className="rounded-[8px] bg-[#747F8D] p-4">
      <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[18px] bg-white shadow-sm">
        {showImage && imageUrl && (
          <img src={imageUrl} alt="" className="aspect-[20/13] w-full object-cover" />
        )}
        <div className="space-y-2 px-4 py-4 text-[14px] leading-[1.45] text-ink">
          {priorityId === ANNOUNCEMENT_PRIORITY.urgent && (
            <div className="text-[12px] font-bold text-danger">ด่วน</div>
          )}
          {title ? (
            <div className="text-[16px] font-bold">{title}</div>
          ) : (
            <div className="text-[16px] font-bold text-ink/30">หัวข้อประกาศ</div>
          )}
          {message ? (
            <div className="whitespace-pre-wrap break-words text-[13px] text-ink/70">{message}</div>
          ) : (
            <div className="text-[13px] text-ink/30">ข้อความประกาศ…</div>
          )}
        </div>
        {showButton && (
          <div className="border-t border-black/5 px-3 py-3">
            <div className="flex h-9 items-center justify-center rounded-[6px] bg-brand text-[13px] font-bold text-white">
              {buttonLabel || "เปิดลิงก์"}
            </div>
            {!linkUrl && (
              <p className="mt-2 text-center text-[11px] text-ink/45">ยังไม่มีลิงก์ — กรอกด้านซ้าย</p>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-[12px] text-white/80">พรีวิวการ์ดที่ผู้รับจะเห็นใน LINE</p>
    </div>
  );
}

export function AnnounceScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<CardLayout>("card");
  const [starterId, setStarterId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [buttonLabel, setButtonLabel] = useState("เปิดลิงก์");
  const [image, setImage] = useState<ImageDraft | null>(null);
  const [priorityId, setPriorityId] = useState<number>(ANNOUNCEMENT_PRIORITY.normal);
  const [mode, setMode] = useState<SendMode>("now");
  const [scheduleDate, setScheduleDate] = useState(todayIso);
  const [scheduleTime, setScheduleTime] = useState(nextHourTime);
  const [items, setItems] = useState<Announcement[]>([]);
  const [statuses, setStatuses] = useState<AnnouncementLookup[]>([]);
  const [priorities, setPriorities] = useState<AnnouncementLookup[]>([]);
  const [filterStatusId, setFilterStatusId] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const trimmedTitle = title.trim();
  const trimmedMessage = message.trim();
  const trimmedLink = linkUrl.trim();
  const trimmedButton = buttonLabel.trim() || "เปิดลิงก์";
  const wantsButton = layout === "card" || layout === "text_button";
  const wantsImage = layout === "card";
  const effectiveLink = wantsButton ? trimmedLink : "";
  const lineBody = buildLineBody(trimmedTitle, trimmedMessage, effectiveLink, priorityId);
  const remaining = MAX_MESSAGE - [...lineBody].length;
  const hasContent = Boolean(trimmedTitle || trimmedMessage || (wantsImage && image) || effectiveLink);
  const canPublish =
    hasContent &&
    remaining >= 0 &&
    (!effectiveLink || isHttpUrl(effectiveLink)) &&
    (!wantsButton || Boolean(effectiveLink));

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [pageData, statusRows, priorityRows] = await Promise.all([
        listAnnouncementsPage(page, pageSize, filterStatusId || undefined),
        listAnnouncementStatuses(),
        listAnnouncementPriorities(),
      ]);
      setItems(pageData.items ?? []);
      setTotal(pageData.total ?? 0);
      setStatuses(statusRows);
      setPriorities(priorityRows);
    } catch (err) {
      setNotice({ tone: "error", message: apiMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterStatusId]);

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
    setLayout("card");
    setStarterId(null);
    setTitle("");
    setMessage("");
    setLinkUrl("");
    setButtonLabel("เปิดลิงก์");
    clearImage();
    setPriorityId(ANNOUNCEMENT_PRIORITY.normal);
    setMode("now");
    setScheduleDate(todayIso());
    setScheduleTime(nextHourTime());
  }

  function applyStarter(starter: ContentStarter) {
    setStarterId(starter.id);
    setLayout(starter.layout);
    setTitle(starter.title);
    setMessage(starter.message);
    setPriorityId(starter.priorityId);
    setButtonLabel(starter.buttonLabel);
    if (starter.layout !== "card") clearImage();
  }

  function selectLayout(next: CardLayout) {
    setLayout(next);
    setStarterId(null);
    if (next !== "card") clearImage();
    if (next === "text") setLinkUrl("");
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice({ tone: "error", message: "แนบได้เฉพาะไฟล์รูปภาพ" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setNotice({ tone: "error", message: "รูปต้องไม่เกิน 5 MB" });
      return;
    }
    clearImage();
    try {
      const compressed = await compressAnnouncementImage(file);
      setImage({
        file: compressed,
        name: compressed.name,
        previewUrl: URL.createObjectURL(compressed),
      });
    } catch {
      setNotice({ tone: "error", message: "บีบอัดรูปไม่สำเร็จ" });
    }
  }

  function validateForPublish(): string | null {
    if (!hasContent) return "กรอกหัวข้อ ข้อความ หรือแนบรูปอย่างน้อยหนึ่งอย่าง";
    if (remaining < 0) return `ข้อความรวมยาวเกิน ${MAX_MESSAGE.toLocaleString("th-TH")} ตัวอักษร`;
    if (wantsButton && !effectiveLink) return "รูปแบบนี้ต้องมีลิงก์สำหรับปุ่มกด";
    if (effectiveLink && !isHttpUrl(effectiveLink)) return "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://";
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
      let imageUrl = "";
      let imageName = "";
      if (wantsImage && image) {
        const uploaded = await uploadAnnouncementImage(image.file);
        imageUrl = uploaded.imageUrl;
        imageName = uploaded.imageName;
      }
      await createAnnouncement({
        title: trimmedTitle,
        message: trimmedMessage,
        linkUrl: effectiveLink,
        imageUrl,
        imageName,
        buttonLabel: effectiveLink ? trimmedButton : "",
        priorityId,
        mode: nextMode,
        scheduledAt,
      });
      clearForm();
      setPage(1);
      await refresh();
      setNotice({
        tone: "success",
        message:
          nextMode === "draft"
            ? "บันทึกร่างแล้ว"
            : nextMode === "schedule"
              ? "ตั้งเวลาส่งแล้ว"
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
    setNotice({
      tone: "confirm",
      message:
        mode === "schedule"
          ? `ยืนยันตั้งเวลาส่งประกาศ ${formatWhen(schedule.scheduledAt!)} ไปยังผู้ติดตาม LINE OA?`
          : "ยืนยันส่งประกาศไปยังผู้ติดตาม LINE OA ทันที?",
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

  function sendDraft(id: string) {
    setNotice({
      tone: "confirm",
      message: "ยืนยันส่งร่างนี้เข้า LINE OA ทันที?",
      accept: async () => {
        setBusy(true);
        try {
          await sendAnnouncementDraft(id);
          await refresh();
          setNotice({ tone: "success", message: "ส่งประกาศเข้า LINE OA แล้ว" });
        } catch (err) {
          await refresh();
          setNotice({ tone: "error", message: apiMessage(err) });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <CanRead resource="announcements">
      <div className="h-full overflow-y-auto px-7 py-6">
        <PageHeader current="ประกาศ LINE" />

        <CanAdd resource="announcements">
          {/* 1. Layout templates */}
          <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
            <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">1. เลือกรูปแบบการ์ด</div>
            <div className="grid gap-3 px-6 py-5 sm:grid-cols-3">
              {LAYOUTS.map((item) => {
                const Icon = item.icon;
                const active = layout === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectLayout(item.id)}
                    className={`rounded-[8px] border px-4 py-4 text-left transition-colors ${
                      active ? "border-brand bg-pick" : "border-frame bg-white hover:bg-table"
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.75} className={active ? "text-brand" : "text-ink/50"} />
                    <div className="mt-2 text-[14px] font-bold">{item.title}</div>
                    <div className="mt-1 text-[12px] text-ink/55">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Content starters */}
          <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
            <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">2. เนื้อหาเริ่มต้น (ถ้าต้องการ)</div>
            <div className="flex flex-wrap gap-2 px-6 py-5">
              {STARTERS.map((item) => {
                const active = starterId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyStarter(item)}
                    className={`rounded-[6px] border px-3 py-2 text-[13px] font-bold transition-colors ${
                      active ? "border-brand bg-brand text-white" : "border-frame bg-white text-ink hover:bg-pick"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <span className="self-center text-[12px] text-ink/45">กดแล้วแก้ข้อความต่อได้</span>
            </div>
          </div>

          {/* 3. Compose + live preview */}
          <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
            <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">3. เขียนประกาศ</div>
            <form
              className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_300px]"
              onSubmit={(event) => {
                event.preventDefault();
                requestPublish();
              }}
            >
              <div className="grid gap-4 content-start">
                <label className="block text-[14px] font-bold leading-[1.4]">
                  หัวข้อ
                  <input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value.slice(0, MAX_TITLE));
                      setStarterId(null);
                    }}
                    maxLength={MAX_TITLE}
                    placeholder="เช่น แจ้งเปิดรับข้าวเปลือก"
                    className={`${inputClass} mt-1`}
                  />
                </label>

                <label className="block text-[14px] font-bold leading-[1.4]">
                  ข้อความ
                  <textarea
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      setStarterId(null);
                    }}
                    rows={7}
                    placeholder="รายละเอียดประกาศจากโรงสี…"
                    className={`${inputClass} mt-1 h-auto min-h-[160px] resize-y py-3 leading-[1.5]`}
                  />
                </label>

                {wantsImage && (
                  <div className="text-[14px] font-bold leading-[1.4]">
                    รูปหัวการ์ด
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={(event) => void onPickImage(event.target.files?.[0])}
                    />
                    {image ? (
                      <div className="mt-1 overflow-hidden rounded-[8px] border border-frame">
                        <img src={image.previewUrl} alt="" className="h-36 w-full object-cover" />
                        <div className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-normal text-ink/70">
                          <span className="truncate">
                            {image.name} · {(image.file.size / 1024).toFixed(0)} KB
                          </span>
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
                        className="mt-1 flex h-36 w-full flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-line bg-white text-[13px] font-normal text-ink/55 transition-colors hover:bg-pick"
                      >
                        <ImagePlus size={22} strokeWidth={1.75} />
                        แนบรูป JPEG / PNG
                        <span className="text-[12px]">บีบอัดเบาๆ · ไม่เกิน 5 MB</span>
                      </button>
                    )}
                  </div>
                )}

                {wantsButton && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
                      ลิงก์เมื่อกดปุ่ม
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        placeholder="https://…"
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <label className="block text-[14px] font-bold leading-[1.4] sm:col-span-2">
                      ข้อความบนปุ่ม
                      <input
                        value={buttonLabel}
                        onChange={(event) => setButtonLabel(event.target.value.slice(0, MAX_BUTTON))}
                        maxLength={MAX_BUTTON}
                        placeholder="เปิดลิงก์"
                        className={`${inputClass} mt-1`}
                      />
                      <span className="mt-1 block text-[12px] font-normal text-ink/45">
                        สูงสุด {MAX_BUTTON} ตัวอักษร · ข้อความนี้จะโผล่บนปุ่มใน LINE
                      </span>
                    </label>
                  </div>
                )}

                <fieldset className="grid gap-3 border-t border-frame pt-4">
                  <legend className="text-[14px] font-bold leading-[1.4]">4. การส่ง</legend>
                  <div className="flex flex-wrap gap-4">
                    {(priorities.length
                      ? priorities
                      : [
                          { id: ANNOUNCEMENT_PRIORITY.normal, name: "ปกติ" },
                          { id: ANNOUNCEMENT_PRIORITY.urgent, name: "ด่วน" },
                        ]
                    ).map((item) => (
                      <label key={item.id} className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-normal">
                        <input
                          type="radio"
                          name="priority"
                          checked={priorityId === item.id}
                          onChange={() => setPriorityId(item.id)}
                          className="h-4 w-4 accent-ink"
                        />
                        {item.name}
                      </label>
                    ))}
                  </div>
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
                    <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="rounded-[8px] border border-frame bg-table px-4 py-3 text-[13px] text-ink/70">
                    ผู้รับ: ทุกคนที่แอดเพื่อน LINE OA · ช่องทาง: LINE Flex Message
                  </div>
                </fieldset>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-frame pt-4">
                  <p className={`text-[13px] ${remaining < 100 ? "font-bold text-danger" : "text-ink/50"}`}>
                    เหลือ {remaining.toLocaleString("th-TH")} ตัวอักษร
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <SecondaryButton type="button" disabled={!hasContent || busy} onClick={clearForm}>
                      ล้าง
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
              </div>

              <div className="lg:sticky lg:top-4 lg:self-start">
                <div className="mb-2 text-[14px] font-bold">พรีวิวสด</div>
                <LineCardPreview
                  title={trimmedTitle}
                  message={trimmedMessage}
                  linkUrl={effectiveLink}
                  buttonLabel={trimmedButton}
                  priorityId={priorityId}
                  imageUrl={image?.previewUrl ?? null}
                  showImage={wantsImage}
                  showButton={wantsButton}
                />
              </div>
            </form>
          </div>
        </CanAdd>

        <div className="mb-0 flex flex-wrap items-end gap-2">
          <StatusTab
            label="ทั้งหมด"
            active={filterStatusId === 0}
            onClick={() => {
              setFilterStatusId(0);
              setPage(1);
            }}
          />
          {(statuses.length
            ? statuses.filter((item) => item.id !== ANNOUNCEMENT_STATUS.sending)
            : [
                { id: ANNOUNCEMENT_STATUS.draft, name: "ร่าง" },
                { id: ANNOUNCEMENT_STATUS.scheduled, name: "ตั้งเวลา" },
                { id: ANNOUNCEMENT_STATUS.sent, name: "ส่งแล้ว" },
                { id: ANNOUNCEMENT_STATUS.failed, name: "ล้มเหลว" },
                { id: ANNOUNCEMENT_STATUS.cancelled, name: "ยกเลิก" },
              ]
          ).map((item) => (
            <StatusTab
              key={item.id}
              label={item.name}
              active={filterStatusId === item.id}
              onClick={() => {
                setFilterStatusId(item.id);
                setPage(1);
              }}
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-b-[8px] rounded-tr-[8px] border border-frame">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
            <span className="inline-flex items-center gap-2">
              <Megaphone size={18} strokeWidth={1.75} aria-hidden />
              ประวัติประกาศ
            </span>
            <span className="text-[14px] font-normal">{loading ? "กำลังโหลด…" : `${total} รายการ`}</span>
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
                  <th className="px-5 py-3 font-bold">ผู้ส่ง</th>
                  <th className="px-5 py-3 font-bold">สถานะ</th>
                  <th className="w-0 whitespace-nowrap px-5 py-3 font-bold">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-6 text-ink/60">
                      ยังไม่มีประกาศ
                    </td>
                  </tr>
                )}
                {items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                    <td className="px-5 py-3 align-top">{formatWhen(item.createdAt)}</td>
                    <td className="px-5 py-3 align-top">
                      {item.scheduledAt
                        ? formatWhen(item.scheduledAt)
                        : item.statusId === ANNOUNCEMENT_STATUS.draft
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
                      <span className={item.priorityId === ANNOUNCEMENT_PRIORITY.urgent ? "font-bold text-danger" : ""}>
                        {item.priority?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-top">{item.createdByName || "—"}</td>
                    <td className="px-5 py-3 align-top text-ink/70">{item.status?.name ?? "—"}</td>
                    <td className="w-0 whitespace-nowrap px-5 py-3 align-top">
                      <div className="flex gap-2">
                        {item.statusId === ANNOUNCEMENT_STATUS.draft && (
                          <CanAdd resource="announcements">
                            <PrimaryButton type="button" compact disabled={busy} onClick={() => sendDraft(item.id)}>
                              ส่ง
                            </PrimaryButton>
                          </CanAdd>
                        )}
                        {item.statusId === ANNOUNCEMENT_STATUS.scheduled && (
                          <CanDelete resource="announcements">
                            <PrimaryButton type="button" compact disabled={busy} onClick={() => cancelScheduled(item.id)}>
                              ยกเลิกคิว
                            </PrimaryButton>
                          </CanDelete>
                        )}
                        {item.statusId !== ANNOUNCEMENT_STATUS.draft &&
                          item.statusId !== ANNOUNCEMENT_STATUS.scheduled && (
                            <span className="text-ink/35">—</span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {total > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </div>

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
    </CanRead>
  );
}
