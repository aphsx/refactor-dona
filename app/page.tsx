import { redirect } from "next/navigation";

// รับซื้อวันนี้ — พักไว้ก่อน
// import { IntakeScreen } from "@/components/intake-screen";

export default function Page() {
  redirect("/plan");
}
