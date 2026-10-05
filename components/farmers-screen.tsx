"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { CanAdd } from "@/components/can";
import { AddFarmer } from "@/components/groups-screen";
import { useMill } from "@/components/store";
import { useServerPage } from "@/components/server-page";
import { Glyph, PageHeader, Pagination, PrimaryButton, SecondaryButton, TableScroll, openRow, rowTone, tableClass } from "@/components/ui";
import { api } from "@/lib/api";
import { farmerName, formatKg, personRole, roleTitle } from "@/lib/mill";

export function FarmersScreen() {
  const router = useRouter();
  const { groups, roleGrants, revision, farmerPage } = useMill();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const page = useServerPage(
    `${query}:${revision}`,
    (pageNo, pageSize) => api.listFarmersPage({ q: query, page: pageNo, pageSize }),
    query === "" ? farmerPage : null,
  );

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="เกษตรกร" />
      <div className="mb-6 overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ค้นหาเกษตรกร</div>
        <form
          className="flex flex-wrap items-end gap-3 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(draft.trim());
          }}
        >
          <label className="block min-w-[240px] flex-1 text-[14px] font-bold">
            ชื่อหรือเบอร์
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-line px-3 font-normal"
            />
          </label>
          <PrimaryButton type="submit">
            <Glyph icon={Search} />
            ค้นหา
          </PrimaryButton>
          <PrimaryButton
            type="button"
            onClick={() => {
              setDraft("");
              setQuery("");
            }}
          >
            <Glyph icon={RotateCcw} />
            ล้าง
          </PrimaryButton>
        </form>
      </div>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-bar px-6 py-4 text-[16px] font-bold text-white">
          บัญชีรับซื้อ
          <span className="text-[14px] font-normal">{page.total} คน</span>
        </div>
        <TableScroll>
          <table className={tableClass}>
            <thead className="bg-table">
              <tr>
                <th className="px-5 py-3 text-left text-[14px] font-bold">เกษตรกร</th>
                <th className="px-5 py-3 text-left text-[14px] font-bold">เบอร์โทร</th>
                <th className="px-5 py-3 text-left text-[14px] font-bold">กลุ่ม</th>
                <th className="px-5 py-3 text-left text-[14px] font-bold">ตำแหน่ง</th>
                <th className="px-5 py-3 text-left text-[14px] font-bold">รับเข้าโรงสี</th>
                <th className="px-5 py-3 text-left text-[14px] font-bold">แปลง</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {page.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-ink/60">
                    ไม่พบเกษตรกร
                  </td>
                </tr>
              )}
              {page.rows.map((farmer, index) => (
                <tr
                  key={farmer.id}
                  onClick={(event) => openRow(event, () => router.push(`/farmers/manage?farmer=${farmer.id}`))}
                  className={rowTone(index)}
                >
                  <td className="px-5 py-3 font-bold">{farmerName(farmer)}</td>
                  <td className="px-5 py-3">{farmer.tel}</td>
                  <td className="px-5 py-3">{farmer.groupName || groups.find((group) => group.id === farmer.groupId)?.name || "—"}</td>
                  <td className="px-5 py-3">{roleTitle(personRole(roleGrants, groups, farmer.id))}</td>
                  <td className="px-5 py-3">{formatKg(farmer.deliveredKg)}</td>
                  <td className="px-5 py-3">{farmer.plotCount ?? 0}</td>
                  <td className="px-5 py-3">
                    <Link href={`/map?farmer=${farmer.id}`} className="font-bold text-link underline">
                      ดูแปลง
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          pageSize={page.pageSize}
          total={page.total}
          onPageChange={page.setPage}
          onPageSizeChange={page.setPageSize}
        />
        <div className="flex flex-wrap gap-5 px-6 py-4">
          <CanAdd resource="farmers">
            <SecondaryButton className="h-9" onClick={() => setAdding(true)}>
              <Glyph icon={Plus} />
              เพิ่มเกษตรกร
            </SecondaryButton>
          </CanAdd>
        </div>
      </div>
      {adding && <AddFarmer onClose={() => setAdding(false)} />}
    </div>
  );
}
