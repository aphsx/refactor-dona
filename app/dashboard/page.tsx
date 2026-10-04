import { redirect } from "next/navigation";

/** Legacy/bookmark URL — app home is /plan. */
export default function DashboardPage() {
  redirect("/plan");
}
