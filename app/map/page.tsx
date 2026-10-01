import { Suspense } from "react";
import { MapScreen } from "@/components/map-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MapScreen />
    </Suspense>
  );
}
