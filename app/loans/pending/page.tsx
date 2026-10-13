import { Suspense } from "react";
import { LoanPendingScreen } from "@/components/loans-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoanPendingScreen />
    </Suspense>
  );
}
