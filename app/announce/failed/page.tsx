import { AnnouncementListScreen } from "@/components/announcement-list-screen";
import { ANNOUNCEMENT_STATUS } from "@/lib/api";

export default function Page() {
  return <AnnouncementListScreen title="ส่งไม่สำเร็จ" statusId={ANNOUNCEMENT_STATUS.failed} />;
}
