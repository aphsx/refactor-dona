import { apiRequest, getApiToken, ApiError } from "@/lib/api/client";
import type { Announcement, AnnouncementLookup, CreateAnnouncementInput } from "@/lib/domain";

export async function listAnnouncementStatuses() {
  const data = await apiRequest<{ items: AnnouncementLookup[] }>("/announcement-statuses");
  return data.items ?? [];
}

export async function listAnnouncementsPage(page = 1, pageSize = 20, statusId?: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (statusId) params.set("statusId", String(statusId));
  return apiRequest<{
    items: Announcement[];
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  }>(`/announcements?${params}`);
}

export async function createAnnouncement(input: CreateAnnouncementInput) {
  return apiRequest<Announcement>("/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelAnnouncement(id: string) {
  return apiRequest<Announcement>(`/announcements/${id}/cancel`, { method: "POST" });
}

export async function sendAnnouncementDraft(id: string) {
  return apiRequest<Announcement>(`/announcements/${id}/send`, { method: "POST" });
}

export async function uploadAnnouncementImage(file: File) {
  const token = getApiToken();
  if (!token) throw new ApiError("ต้องเข้าสู่ระบบก่อน", 401);
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/announcement-image", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(typeof body?.error === "string" ? body.error : "อัปโหลดรูปไม่สำเร็จ", response.status);
  }
  return body as { imageUrl: string; imageName: string };
}
