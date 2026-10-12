import { AnnouncementListScreen } from "@/components/announcement-list-screen";
import { ANNOUNCEMENT_STATUS } from "@/lib/api";

export default function Page() {
  return <AnnouncementListScreen title="ยกเลิกคิว" statusId={ANNOUNCEMENT_STATUS.cancelled} />;
}
