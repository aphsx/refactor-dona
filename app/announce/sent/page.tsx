import { AnnouncementListScreen } from "@/components/announcement-list-screen";
import { ANNOUNCEMENT_STATUS } from "@/lib/api";

export default function Page() {
  return <AnnouncementListScreen title="ส่งแล้ว" statusId={ANNOUNCEMENT_STATUS.sent} />;
}
