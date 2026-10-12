"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, ImagePlus, Save, Send, X } from "lucide-react";
import { CanAdd, CanRead } from "@/components/can";
import {
  ConfirmAlert,
  DateField,
  Glyph,
  PageHeader,
  PrimaryButton,
  ResultAlert,
  SecondaryButton,
  inputClass,
} from "@/components/ui";
import {
  ANNOUNCEMENT_PRIORITY,
  apiMessage,
  createAnnouncement,
  listAnnouncementPriorities,
  uploadAnnouncementImage,
  type AnnouncementImageLayout,
  type AnnouncementLookup,
} from "@/lib/api";
import { compressAnnouncementImage } from "@/lib/compress-image";

const MAX_MESSAGE = 5000;
const MAX_TITLE = 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BUTTON = 20;

/**
 * Message kinds aligned with LINE OA Manager / broadcast composers:
 * text | image | card — not Flex layout recipes.
 */
type MessageKind = "text" | "image" | "card";

type SendMode = "now" | "schedule";
type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string };

type ImageDraft = {
  file: File;
  name: string;
  previewUrl: string;
};

const MESSAGE_KINDS: { id: MessageKind; title: string; desc: string }[] = [
  { id: "text", title: "ข้อความ", desc: "ประกาศสั้นๆ ในแชท" },
  { id: "image", title: "รูปภาพ", desc: "โปสเตอร์ / โปรโมชัน" },
  { id: "card", title: "การ์ด", desc: "ข้อความ · เลือกรูปและปุ่มได้" },
];

const IMAGE_LAYOUTS: { id: AnnouncementImageLayout; title: string }[] = [
  { id: "standard", title: "แบบปกติ" },
  { id: "full", title: "เต็มแชท" },
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

/** Tiny chat bubble preview for the kind picker. */
function KindSkeleton({ kind }: { kind: MessageKind }) {
  if (kind === "text") {
    return (
      <div className="mx-auto w-[88px] rounded-[6px] bg-[#747F8D] p-1.5">
        <div className="rounded-[8px] rounded-bl-[3px] bg-white px-2 py-2">
          <div className="h-1.5 w-[85%] rounded-[1px] bg-black/[0.14]" />
          <div className="mt-1 h-1.5 w-[60%] rounded-[1px] bg-black/[0.08]" />
        </div>
      </div>
    );
  }
  if (kind === "image") {
    return (
      <div className="mx-auto w-[88px] rounded-[6px] bg-[#747F8D] p-1">
        <div className="h-16 w-full overflow-hidden rounded-[6px] bg-black/[0.12]" />
      </div>
    );
  }
  return (
    <div className="mx-auto w-[88px] rounded-[6px] bg-[#747F8D] p-1">
      <div className="overflow-hidden rounded-[7px] bg-white">
        <div className="space-y-1 px-1.5 py-2">
          <div className="h-1.5 w-[70%] rounded-[1px] bg-black/[0.16]" />
          <div className="h-1 w-full rounded-[1px] bg-black/[0.08]" />
          <div className="h-1 w-[80%] rounded-[1px] bg-black/[0.08]" />
        </div>
        <div className="flex gap-0.5 border-t border-black/5 px-1 py-1">
          <div className="h-2 flex-1 rounded-[1px] bg-black/[0.06]" />
          <div className="h-2 flex-1 rounded-[1px] bg-brand/50" />
        </div>
      </div>
    </div>
  );
}

function ChatBubbleSkeleton({
  side,
  width,
}: {
  side: "left" | "right";
  width: string;
}) {
  const bubble = (
    <div
      className={`px-3 py-2.5 ${width} ${
        side === "left"
          ? "rounded-[14px] rounded-bl-[4px] bg-white/90"
          : "rounded-[14px] rounded-br-[4px] bg-[#8CD18F]"
      }`}
    >
      <div className={`h-2 w-[78%] rounded-sm ${side === "left" ? "bg-black/[0.1]" : "bg-black/[0.12]"}`} />
      <div className={`mt-1.5 h-2 w-[55%] rounded-sm ${side === "left" ? "bg-black/[0.07]" : "bg-black/[0.08]"}`} />
    </div>
  );

  if (side === "right") {
    return <div className="flex justify-end pl-10">{bubble}</div>;
  }

  return (
    <div className="flex items-end gap-2 pr-10">
      <div className="h-7 w-7 shrink-0 rounded-full bg-white/25" />
      {bubble}
    </div>
  );
}

function LineCardPreview({
  kind,
  title,
  message,
  linkUrl,
  buttonLabel,
  priorityId,
  imageUrl,
  imageLayout = "standard",
  cardUseImage = false,
  cardUseLink = false,
}: {
  kind: MessageKind;
  title: string;
  message: string;
  linkUrl: string;
  buttonLabel: string;
  priorityId: number;
  imageUrl: string | null;
  imageLayout?: AnnouncementImageLayout;
  cardUseImage?: boolean;
  cardUseLink?: boolean;
}) {
  const imageOnly = kind === "image";
  const isText = kind === "text";
  const showImage = imageOnly || (kind === "card" && cardUseImage);
  const showButton = kind === "card" && cardUseLink;
  const aspect = imageOnly ? "aspect-square" : "aspect-[20/13]";
  const imageFull = imageOnly && imageLayout === "full";
  const textBody = [priorityId === ANNOUNCEMENT_PRIORITY.urgent ? "[ด่วน]" : "", title, message]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="overflow-hidden rounded-[12px] border border-black/10 bg-[#7494A9] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-3 bg-[#283849] px-4 py-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-white/20" />
        <div className="min-w-0 flex-1">
          <div className="h-2.5 w-28 rounded-sm bg-white/55" />
          <div className="mt-1.5 h-2 w-16 rounded-sm bg-white/25" />
        </div>
      </div>

      <div className="space-y-3 px-3 py-4">
        <ChatBubbleSkeleton side="left" width="w-[52%]" />
        <ChatBubbleSkeleton side="right" width="w-[44%]" />

        <div className={`flex items-end gap-2 ${imageFull ? "pr-2" : "pr-6"}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-[10px] font-bold text-white">
            OA
          </div>
          {isText ? (
            <div className="min-w-0 flex-1 rounded-[16px] rounded-bl-[4px] bg-white px-3.5 py-3 text-[13px] leading-[1.45] text-ink shadow-sm">
              {textBody ? (
                <div className="whitespace-pre-wrap break-words">{textBody}</div>
              ) : (
                <div className="text-ink/30">ข้อความประกาศ…</div>
              )}
            </div>
          ) : imageOnly ? (
            <div
              className={`min-w-0 flex-1 overflow-hidden rounded-[16px] bg-white shadow-sm ${
                imageFull ? "max-w-none" : "max-w-[78%]"
              }`}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-black/[0.06] text-[12px] text-ink/35">
                  รูปโปรโมชัน
                </div>
              )}
              {linkUrl && (
                <p className="px-3 py-2 text-center text-[11px] text-ink/45">กดที่รูปเพื่อเปิดลิงก์</p>
              )}
            </div>
          ) : (
            <div className="min-w-0 flex-1 overflow-hidden rounded-[16px] bg-white shadow-sm">
              {showImage &&
                (imageUrl ? (
                  <img src={imageUrl} alt="" className={`${aspect} w-full object-cover`} />
                ) : (
                  <div className={`flex ${aspect} w-full items-center justify-center bg-black/[0.06] text-[12px] text-ink/35`}>
                    รูปหัวการ์ด
                  </div>
                ))}
              <div className="space-y-2 px-4 py-3.5 text-[14px] leading-[1.45] text-ink">
                {priorityId === ANNOUNCEMENT_PRIORITY.urgent && (
                  <div className="text-[12px] font-bold text-danger">ด่วน</div>
                )}
                {title ? (
                  <div className="text-[16px] font-bold">{title}</div>
                ) : (
                  <div className="text-[16px] font-bold text-ink/30">หัวข้อ</div>
                )}
                {message ? (
                  <div className="whitespace-pre-wrap break-words text-[13px] text-ink/70">{message}</div>
                ) : (
                  <div className="text-[13px] text-ink/30">ข้อความ…</div>
                )}
              </div>
              {showButton && (
                <div className="border-t border-black/5 px-3 py-3">
                  <div className="flex h-9 items-center justify-center rounded-[6px] bg-brand text-[13px] font-bold text-white">
                    {buttonLabel || "เปิดลิงก์"}
                  </div>
                  {!linkUrl && (
                    <p className="mt-2 text-center text-[11px] text-ink/45">ยังไม่มีลิงก์</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-black/10 bg-[#E8EEF2] px-3 py-2.5">
        <div className="h-8 flex-1 rounded-full bg-white" />
        <div className="h-8 w-8 shrink-0 rounded-full bg-white/80" />
      </div>
    </div>
  );
}


export function AnnounceScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<MessageKind>("card");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [buttonLabel, setButtonLabel] = useState("เปิดลิงก์");
  const [image, setImage] = useState<ImageDraft | null>(null);
  const [imageLayout, setImageLayout] = useState<AnnouncementImageLayout>("standard");
  const [cardUseImage, setCardUseImage] = useState(false);
  const [cardUseLink, setCardUseLink] = useState(false);
  const [priorityId, setPriorityId] = useState<number>(ANNOUNCEMENT_PRIORITY.normal);
  const [mode, setMode] = useState<SendMode>("now");
  const [scheduleDate, setScheduleDate] = useState(todayIso);
  const [scheduleTime, setScheduleTime] = useState(nextHourTime);
  const [priorities, setPriorities] = useState<AnnouncementLookup[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const trimmedTitle = title.trim();
  const trimmedMessage = message.trim();
  const trimmedLink = linkUrl.trim();
  const trimmedButton = buttonLabel.trim() || "เปิดลิงก์";
  const imageOnly = kind === "image";
  const isCard = kind === "card";
  const wantsImage = imageOnly || (isCard && cardUseImage);
  const wantsButton = isCard && cardUseLink;
  const wantsLink = imageOnly || wantsButton;
  const effectiveLink = wantsLink ? trimmedLink : "";
  const publishTitle = imageOnly ? "" : trimmedTitle;
  const publishMessage = imageOnly ? "" : trimmedMessage;
  const lineBody = buildLineBody(publishTitle, publishMessage, effectiveLink, priorityId);
  const remaining = MAX_MESSAGE - [...lineBody].length;
  const hasContent = imageOnly
    ? Boolean(image)
    : Boolean(trimmedTitle || trimmedMessage);
  const canPublish =
    hasContent &&
    remaining >= 0 &&
    (!wantsImage || Boolean(image)) &&
    (!wantsButton || Boolean(effectiveLink)) &&
    (!effectiveLink || isHttpUrl(effectiveLink));

  useEffect(() => {
    void listAnnouncementPriorities()
      .then(setPriorities)
      .catch((err) => setNotice({ tone: "error", message: apiMessage(err) }));
  }, []);

  function clearImage() {
    setImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function clearForm() {
    setKind("card");
    setTitle("");
    setMessage("");
    setLinkUrl("");
    setButtonLabel("เปิดลิงก์");
    setImageLayout("standard");
    setCardUseImage(false);
    setCardUseLink(false);
    clearImage();
    setPriorityId(ANNOUNCEMENT_PRIORITY.normal);
    setMode("now");
    setScheduleDate(todayIso());
    setScheduleTime(nextHourTime());
  }

  function selectKind(next: MessageKind) {
    setKind(next);
    if (next === "text") {
      clearImage();
      setLinkUrl("");
      setImageLayout("standard");
      setCardUseImage(false);
      setCardUseLink(false);
    }
    if (next === "image") {
      setTitle("");
      setMessage("");
      setButtonLabel("เปิดลิงก์");
      setCardUseImage(false);
      setCardUseLink(false);
    }
    if (next === "card") {
      setCardUseImage(false);
      setCardUseLink(false);
      setImageLayout("standard");
      clearImage();
      setLinkUrl("");
    }
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
    if (imageOnly && !image) return "ประเภทรูปภาพต้องแนบรูป";
    if (!imageOnly && !trimmedTitle && !trimmedMessage) return "กรอกหัวข้อหรือข้อความ";
    if (isCard && cardUseImage && !image) return "เปิดใช้รูปแล้ว — แนบรูปด้วย หรือปิดตัวเลือกนี้";
    if (isCard && cardUseLink && !effectiveLink) return "เปิดใช้ปุ่มลิงก์แล้ว — กรอกลิงก์ด้วย หรือปิดตัวเลือกนี้";
    if (!hasContent) return "กรอกหัวข้อ ข้อความ หรือแนบรูปอย่างน้อยหนึ่งอย่าง";
    if (remaining < 0) return `ข้อความรวมยาวเกิน ${MAX_MESSAGE.toLocaleString("th-TH")} ตัวอักษร`;
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
        title: publishTitle,
        message: publishMessage,
        linkUrl: effectiveLink,
        imageUrl,
        imageName,
        buttonLabel: wantsButton && effectiveLink ? trimmedButton : "",
        imageLayout: imageOnly ? imageLayout : "standard",
        priorityId,
        mode: nextMode,
        scheduledAt,
      });
      clearForm();
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

  return (
    <CanRead resource="announcements">
      <div className="no-scrollbar h-full overflow-y-auto px-7 py-6">
        <PageHeader current="สร้าง" />

        <CanAdd resource="announcements">
          <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
            <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ประเภทข้อความ</div>
            <div className="grid gap-3 px-6 py-4 sm:grid-cols-3">
              {MESSAGE_KINDS.map((item) => {
                const active = kind === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectKind(item.id)}
                    className={`rounded-[6px] border px-3 py-3 transition-colors ${
                      active ? "border-brand bg-pick" : "border-frame bg-white hover:bg-table"
                    }`}
                  >
                    <KindSkeleton kind={item.id} />
                    <div className={`mt-2 text-center text-[13px] font-bold ${active ? "text-brand" : "text-ink"}`}>
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-center text-[11px] text-ink/50">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
            <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">เขียนประกาศ</div>
            <form
              className="grid gap-6 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]"
              onSubmit={(event) => {
                event.preventDefault();
                requestPublish();
              }}
            >
              <div className="grid gap-4 content-start">
                {!imageOnly && (
                  <>
                    <label className="block text-[14px] font-bold leading-[1.4]">
                      หัวข้อ
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value.slice(0, MAX_TITLE))}
                        maxLength={MAX_TITLE}
                        className={`${inputClass} mt-1`}
                      />
                    </label>

                    <label className="block text-[14px] font-bold leading-[1.4]">
                      ข้อความ
                      <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        rows={7}
                        className={`${inputClass} mt-1 h-auto min-h-[160px] resize-y py-3 leading-[1.5]`}
                      />
                    </label>
                  </>
                )}

                {isCard && (
                  <div className="grid gap-3">
                    <div className="text-[14px] font-bold leading-[1.4]">ตัวเลือกเพิ่ม (ไม่บังคับ)</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-[6px] border px-3 py-2.5 text-[14px] font-bold ${
                          cardUseImage ? "border-brand bg-pick" : "border-frame bg-white hover:bg-table"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={cardUseImage}
                          onChange={(event) => {
                            const on = event.target.checked;
                            setCardUseImage(on);
                            if (!on) clearImage();
                          }}
                          className="h-4 w-4 accent-ink"
                        />
                        ใส่รูปหัวการ์ด
                      </label>
                      <label
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-[6px] border px-3 py-2.5 text-[14px] font-bold ${
                          cardUseLink ? "border-brand bg-pick" : "border-frame bg-white hover:bg-table"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={cardUseLink}
                          onChange={(event) => {
                            const on = event.target.checked;
                            setCardUseLink(on);
                            if (!on) {
                              setLinkUrl("");
                              setButtonLabel("เปิดลิงก์");
                            }
                          }}
                          className="h-4 w-4 accent-ink"
                        />
                        ใส่ปุ่มลิงก์
                      </label>
                    </div>
                  </div>
                )}

                {wantsImage && (
                  <div className="text-[14px] font-bold leading-[1.4]">
                    {imageOnly ? "รูปโปรโมชัน" : "รูปหัวการ์ด"}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={(event) => void onPickImage(event.target.files?.[0])}
                    />
                    {image ? (
                      <div className="mt-1 flex items-center justify-between gap-2 rounded-[8px] border border-frame bg-white px-3 py-2.5 text-[13px] font-normal text-ink/70">
                        <span className="truncate">
                          {image.name} · {(image.file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="inline-flex shrink-0 items-center gap-1 font-bold text-brand hover:underline"
                        >
                          <X size={14} strokeWidth={2} />
                          ลบ
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-line bg-white px-3 py-2.5 text-[13px] font-normal text-ink/55 transition-colors hover:bg-pick"
                      >
                        <ImagePlus size={18} strokeWidth={1.75} />
                        แนบรูป
                      </button>
                    )}
                  </div>
                )}

                {imageOnly && (
                  <div className="grid gap-3">
                    <div className="text-[14px] font-bold leading-[1.4]">ขนาดรูปในแชท LINE</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {IMAGE_LAYOUTS.map((item) => {
                        const active = imageLayout === item.id;
                        return (
                          <label
                            key={item.id}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-[6px] border px-3 py-2.5 text-[14px] font-bold ${
                              active ? "border-brand bg-pick" : "border-frame bg-white hover:bg-table"
                            }`}
                          >
                            <input
                              type="radio"
                              name="image-layout"
                              checked={active}
                              onChange={() => setImageLayout(item.id)}
                              className="h-4 w-4 accent-ink"
                            />
                            {item.title}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {imageOnly && (
                  <label className="block text-[14px] font-bold leading-[1.4]">
                    ลิงก์เมื่อกดรูป (ไม่บังคับ)
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(event) => setLinkUrl(event.target.value)}
                      placeholder="https://"
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                )}

                {wantsButton && (
                  <div className="grid gap-4">
                    <label className="block text-[14px] font-bold leading-[1.4]">
                      ลิงก์
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(event) => setLinkUrl(event.target.value)}
                        placeholder="https://"
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <label className="block text-[14px] font-bold leading-[1.4]">
                      ข้อความปุ่ม
                      <input
                        value={buttonLabel}
                        onChange={(event) => setButtonLabel(event.target.value.slice(0, MAX_BUTTON))}
                        maxLength={MAX_BUTTON}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                  </div>
                )}

                <div className="grid gap-3 border-t border-frame pt-4">
                  <div className="text-[14px] font-bold leading-[1.4]">การส่ง</div>
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
                </div>

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

              <div className="xl:sticky xl:top-4 xl:self-start">
                <div className="mb-2 text-[14px] font-bold">พรีวิวแชท LINE</div>
                <LineCardPreview
                  kind={kind}
                  title={trimmedTitle}
                  message={trimmedMessage}
                  linkUrl={effectiveLink}
                  buttonLabel={trimmedButton}
                  priorityId={priorityId}
                  imageUrl={image?.previewUrl ?? null}
                  imageLayout={imageLayout}
                  cardUseImage={cardUseImage}
                  cardUseLink={cardUseLink}
                />
              </div>
            </form>
          </div>
        </CanAdd>

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
