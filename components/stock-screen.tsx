"use client";

import { useState } from "react";
import { CloudSun } from "lucide-react";
import { useMill } from "@/components/store";
import { Dialog, Kpi, PageHeader, Pagination, PrimaryButton, SecondaryButton, inputClass, usePagination } from "@/components/ui";
import { formatKg, formatTon, type Silo } from "@/lib/mill";

export function StockScreen() {
  const { silos, dryPaddy } = useMill();
  const [drying, setDrying] = useState<Silo | null>(null);
  const wetKg = silos.filter((silo) => silo.stage === "ชื้น").reduce((sum, silo) => sum + silo.kg, 0);
  const dryKg = silos.filter((silo) => silo.stage === "แห้ง").reduce((sum, silo) => sum + silo.kg, 0);
  const headKg = silos.filter((silo) => silo.stage === "ต้นข้าว").reduce((sum, silo) => sum + silo.kg, 0);
  const page = usePagination(silos);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="ไซโล" />
      <div className="mb-6 flex items-center gap-3 rounded-[8px] border border-frame bg-white px-4 py-3">
        <CloudSun size={24} strokeWidth={1.75} className="text-brand" />
        <p className="text-[14px]">อากาศที่ลานตาก: เมฆบางส่วน 32° · โอกาสฝน 20% — ตากได้</p>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi label="เปลือกชื้น รอตาก" value={formatTon(wetKg)} />
        <Kpi label="เปลือกแห้ง พร้อมสี" value={formatTon(dryKg)} />
        <Kpi label="ต้นข้าวในโกดัง" value={formatTon(headKg)} />
      </div>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ปริมาณในไซโล</div>
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="bg-table">
            <tr>
              {["ไซโล", "พันธุ์", "สถานะ", "ปริมาณ", "ความจุ", ""].map((label) => (
                <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.rows.map((silo, index) => {
              const ratio = Math.min(100, Math.round((silo.kg / silo.capacityKg) * 100));
              return (
                <tr key={silo.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                  <td className="px-5 py-3 font-bold">{silo.name}</td>
                  <td className="px-5 py-3">{silo.variety}</td>
                  <td className="px-5 py-3">{silo.stage}</td>
                  <td className="px-5 py-3">
                    <div>{formatKg(silo.kg)}</div>
                    <div className="mt-1 h-2 w-28 overflow-hidden rounded-[4px] bg-table">
                      <div className="h-full bg-brand" style={{ width: `${ratio}%` }} />
                    </div>
                  </td>
                  <td className="px-5 py-3">{formatTon(silo.capacityKg)}</td>
                  <td className="px-5 py-3 text-right">
                    {silo.stage === "ชื้น" && (
                      <SecondaryButton className="h-9" onClick={() => setDrying(silo)}>
                        บันทึกการตาก
                      </SecondaryButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          page={page.page}
          pageCount={page.pageCount}
          pageSize={page.pageSize}
          total={page.total}
          onPageChange={page.setPage}
          onPageSizeChange={page.setPageSize}
        />
      </div>
      {drying && <DryDialog silo={drying} onClose={() => setDrying(null)} onDry={dryPaddy} />}
    </div>
  );
}

function DryDialog({
  silo,
  onClose,
  onDry,
}: {
  silo: Silo;
  onClose: () => void;
  onDry: (siloId: string, kg: number) => string | null;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog title={`ตากจาก ${silo.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const kg = Number(amount);
          if (!Number.isFinite(kg) || kg <= 0) {
            setError("กรอกปริมาณเป็นกิโลกรัม");
            return;
          }
          const message = onDry(silo.id, kg);
          if (message) {
            setError(message);
            return;
          }
          onClose();
        }}
      >
        <p className="text-[14px]">
          ย้าย{silo.variety}จากไซโลชื้นไปไซโลแห้ง คงเหลือในไซโลนี้ {formatKg(silo.kg)}
        </p>
        <label className="block text-[14px] font-bold leading-[1.4]">
          ปริมาณที่ตากเสร็จ (กก.)
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">ย้ายเข้าไซโลแห้ง</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
