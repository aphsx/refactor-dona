import { redirect } from "next/navigation";

/** Legacy URL — รวมเป็น /farmers แล้ว */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ farmer?: string }>;
}) {
  const { farmer } = await searchParams;
  redirect(farmer ? `/farmers?farmer=${encodeURIComponent(farmer)}` : "/farmers");
}
