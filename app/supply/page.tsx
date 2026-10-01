import { Suspense } from "react";
import { SupplyScreen } from "@/components/supply-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SupplyScreen />
    </Suspense>
  );
}
