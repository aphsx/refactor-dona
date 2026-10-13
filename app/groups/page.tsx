import { Suspense } from "react";
import { GroupManageScreen } from "@/components/groups-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GroupManageScreen />
    </Suspense>
  );
}
