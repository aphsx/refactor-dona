export type AnnouncementLookup = {
  id: number;
  code: string;
  name: string;
};

/** รูปประกาศ Flex bubble: standard = mega, full = giga (full chat width). */
export type AnnouncementImageLayout = "standard" | "full";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  imageName: string;
  buttonLabel: string;
  imageLayout: AnnouncementImageLayout;
  statusId: number;
  status: AnnouncementLookup;
  scheduledAt: string | null;
  sentAt: string | null;
  createdByAccountId: string;
  createdByName: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAnnouncementInput = {
  title?: string;
  message?: string;
  linkUrl?: string;
  imageUrl?: string;
  imageName?: string;
  buttonLabel?: string;
  imageLayout?: AnnouncementImageLayout;
  mode: "draft" | "now" | "schedule";
  scheduledAt?: string;
};

export const ANNOUNCEMENT_STATUS = {
  draft: 501,
  scheduled: 502,
  sending: 503,
  sent: 504,
  cancelled: 505,
  failed: 506,
} as const;
