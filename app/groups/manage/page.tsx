import { redirect } from "next/navigation";

/** Legacy URL — รวมเป็น /groups แล้ว */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  redirect(group ? `/groups?group=${encodeURIComponent(group)}` : "/groups");
}
