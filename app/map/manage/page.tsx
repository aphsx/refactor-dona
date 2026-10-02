import { Suspense } from "react";
import { PlotManageScreen } from "@/components/plots-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlotManageScreen />
    </Suspense>
  );
}
