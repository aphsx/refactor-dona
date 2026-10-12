import { AnnouncementListScreen } from "@/components/announcement-list-screen";
import { ANNOUNCEMENT_STATUS } from "@/lib/api";

export default function Page() {
  return <AnnouncementListScreen title="ร่าง" statusId={ANNOUNCEMENT_STATUS.draft} />;
}
