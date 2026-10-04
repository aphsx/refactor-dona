import { Suspense } from "react";
import { VarietyManageScreen } from "@/components/varieties-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VarietyManageScreen />
    </Suspense>
  );
}
