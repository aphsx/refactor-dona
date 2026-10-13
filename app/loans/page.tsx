import { Suspense } from "react";
import { LoanAccountsScreen } from "@/components/loans-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoanAccountsScreen />
    </Suspense>
  );
}
