"use client";

import { useState } from "react";
import { useMill } from "@/components/store";
import { Dialog, PageHeader, Pagination, PrimaryButton, SecondaryButton, Select, inputClass, usePagination } from "@/components/ui";
import { MILL_YIELD, formatKg, splitLot } from "@/lib/mill";

export function MillScreen() {
  const { lots, silos, openLot, closeLot } = useMill();
  const [opening, setOpening] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState("");
  const drySilos = silos.filter((silo) => silo.stage === "แห้ง");
  const closing = lots.find((lot) => lot.id === closingId) ?? null;
  const page = usePagination(lots);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader
        current="ล็อตสี"
        action={<PrimaryButton onClick={() => setOpening(true)}>เปิดล็อตสี</PrimaryButton>}
      />
      <p className="mb-6 text-[14px]">
        ปิดล็อตจะแบ่งน้ำหนักตามเรทโรงสี: {MILL_YIELD.map((item) => `${item.label} ${Math.round(item.ratio * 100)}%`).join(" · ")} แกลบไม่เข้าโกดัง
      </p>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">ล็อต</div>
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="bg-table">
            <tr>
              {["ล็อต", "พันธุ์", "เปลือกเข้า", "ต้นข้าว", "ข้าวหัก", "รำ", "สถานะ", ""].map((label) => (
                <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.rows.map((lot, index) => (
              <tr key={lot.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                <td className="px-5 py-3 font-bold">{lot.code}</td>
                <td className="px-5 py-3">{lot.variety}</td>
                <td className="px-5 py-3">{formatKg(lot.inputKg)}</td>
                <td className="px-5 py-3">{lot.headKg == null ? "—" : formatKg(lot.headKg)}</td>
                <td className="px-5 py-3">{lot.brokenKg == null ? "—" : formatKg(lot.brokenKg)}</td>
                <td className="px-5 py-3">{lot.branKg == null ? "—" : formatKg(lot.branKg)}</td>
                <td className="px-5 py-3">
                  <span className={`text-[12px] font-bold ${lot.status === "ปิดแล้ว" ? "text-ok" : "text-brand"}`}>{lot.status}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  {lot.status === "สีอยู่" && (
                    <PrimaryButton className="h-9" onClick={() => setClosingId(lot.id)}>
                      ปิดล็อต
                    </PrimaryButton>
                  )}
                </td>
              </tr>
            ))}
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
      {opening && <OpenLot drySilos={drySilos} onClose={() => setOpening(false)} onOpen={openLot} />}
      {closing && (
        <Dialog title={`ปิดล็อต ${closing.code}`} onClose={() => setClosingId(null)}>
          <ClosePreview
            inputKg={closing.inputKg}
            error={closeError}
            onCancel={() => setClosingId(null)}
            onConfirm={() => {
              const message = closeLot(closing.id);
              if (message) {
                setCloseError(message);
                return;
              }
              setCloseError("");
              setClosingId(null);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function OpenLot({
  drySilos,
  onClose,
  onOpen,
}: {
  drySilos: { id: string; name: string; variety: string; kg: number }[];
  onClose: () => void;
  onOpen: (siloId: string, kg: number) => string | null;
}) {
  const [siloId, setSiloId] = useState(drySilos[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const silo = drySilos.find((item) => item.id === siloId);

  return (
    <Dialog title="เปิดล็อตสี" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const kg = Number(amount);
          if (!siloId || !Number.isFinite(kg) || kg <= 0) {
            setError("เลือกไซโลและกรอกปริมาณ");
            return;
          }
          const message = onOpen(siloId, kg);
          if (message) {
            setError(message);
            return;
          }
          onClose();
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          ไซโลแห้ง
          <Select
            label="ไซโลแห้ง"
            className="mt-1"
            value={siloId}
            onChange={setSiloId}
            options={drySilos.map((item) => ({ value: item.id, label: `${item.name} · ${item.variety} · ${formatKg(item.kg)}` }))}
          />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          น้ำหนักเปลือกเข้าเครื่อง (กก.)
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
        {silo && <p className="text-[14px] text-ink/70">ข้าวจะถูกกันออกจาก {silo.name} ทันทีที่เปิดล็อต</p>}
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">เปิดล็อต</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}

function ClosePreview({
  inputKg,
  error,
  onCancel,
  onConfirm,
}: {
  inputKg: number;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const parts = splitLot(inputKg);
  return (
    <div className="space-y-4">
      <ul className="overflow-hidden rounded-[8px] border border-frame text-[14px]">
        <li className="flex justify-between px-5 py-3">
          <span>ต้นข้าว</span>
          <span className="font-bold">{formatKg(parts.headKg)}</span>
        </li>
        <li className="flex justify-between bg-table px-5 py-3">
          <span>ข้าวหัก</span>
          <span className="font-bold">{formatKg(parts.brokenKg)}</span>
        </li>
        <li className="flex justify-between px-5 py-3">
          <span>รำ</span>
          <span className="font-bold">{formatKg(parts.branKg)}</span>
        </li>
        <li className="flex justify-between bg-table px-5 py-3">
          <span>แกลบ ไม่เข้าโกดัง</span>
          <span className="font-bold">{formatKg(parts.huskKg)}</span>
        </li>
      </ul>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <div className="flex justify-end gap-3">
        <SecondaryButton onClick={onCancel}>ยกเลิก</SecondaryButton>
        <PrimaryButton onClick={onConfirm}>บันทึกเข้าโกดัง</PrimaryButton>
      </div>
    </div>
  );
}
