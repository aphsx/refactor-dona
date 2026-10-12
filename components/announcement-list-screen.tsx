"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Megaphone } from "lucide-react";
import { CanAdd, CanDelete, CanRead } from "@/components/can";
import {
  ConfirmAlert,
  PageHeader,
  Pagination,
  PrimaryButton,
  ResultAlert,
  TableScroll,
  tableClass,
} from "@/components/ui";
import {
  ANNOUNCEMENT_PRIORITY,
  ANNOUNCEMENT_STATUS,
  apiMessage,
  cancelAnnouncement,
  listAnnouncementsPage,
  sendAnnouncementDraft,
  type Announcement,
} from "@/lib/api";

type Notice =
  | { tone: "confirm"; message: string; accept: () => void | Promise<void> }
  | { tone: "success" | "error"; message: string };

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

export function AnnouncementListScreen({
  title,
  statusId = 0,
}: {
  title: string;
  statusId?: number;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pageData = await listAnnouncementsPage(page, pageSize, statusId || undefined);
      setItems(pageData.items ?? []);
      setTotal(pageData.total ?? 0);
    } catch (err) {
      setNotice({ tone: "error", message: apiMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusId]);

  useEffect(() => {
    setPage(1);
  }, [statusId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
        <PageHeader current={title} />

        <div className="overflow-hidden rounded-[8px] border border-frame">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
            <span className="inline-flex items-center gap-2">
              <Megaphone size={18} strokeWidth={1.75} aria-hidden />
              {title}
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
