import { Suspense } from "react";
import { LoanHistoryScreen } from "@/components/loans-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoanHistoryScreen />
    </Suspense>
  );
}
