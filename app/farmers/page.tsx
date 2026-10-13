import { Suspense } from "react";
import { MemberManageScreen } from "@/components/groups-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MemberManageScreen />
    </Suspense>
  );
}
