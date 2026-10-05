import { redirect } from "next/navigation";

/** Legacy/bookmark URL — app home is /farmers while plan nav is rolled out gradually. */
export default function DashboardPage() {
  redirect("/farmers");
}
