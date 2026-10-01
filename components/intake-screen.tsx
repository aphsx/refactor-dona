"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMill } from "@/components/store";
import { CountBar, Dialog, FarmerSelect, Kpi, PageHeader, PrimaryButton, SecondaryButton, StatusTab, inputClass } from "@/components/ui";
import { farmerName, formatBaht, formatKg, formatTon, settle } from "@/lib/mill";

type TicketFilter = "ทั้งหมด" | "รอชั่ง" | "เข้าไซโล";

export function IntakeScreen() {
  const { tickets, farmers, createTicket, weighTicket } = useMill();
  const [filter, setFilter] = useState<TicketFilter>("ทั้งหมด");
  const [creating, setCreating] = useState(false);
  const [weighId, setWeighId] = useState<string | null>(null);

  const receivedKg = tickets.reduce((sum, ticket) => sum + (ticket.netKg ?? 0), 0);
  const receivedValue = tickets.reduce((sum, ticket) => sum + (ticket.amountBaht ?? 0), 0);
  const waiting = tickets.filter((ticket) => ticket.status === "รอชั่ง").length;
  const weighed = tickets.filter((ticket) => ticket.moisture != null);
  const avgMoisture =
    weighed.length === 0 ? "—" : `${(weighed.reduce((sum, ticket) => sum + (ticket.moisture ?? 0), 0) / weighed.length).toFixed(1)}%`;

  const rows = tickets
    .filter((ticket) => filter === "ทั้งหมด" || ticket.status === filter)
    .slice()
    .sort((a, b) => a.queue - b.queue);

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader
        current="รับซื้อวันนี้"
        action={
          <PrimaryButton onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={1.75} />
            เปิดตั๋วรับซื้อ
          </PrimaryButton>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="รับเข้าไซโลวันนี้" value={formatTon(receivedKg)} />
        <Kpi label="รอชั่ง" value={`${waiting} คัน`} />
        <Kpi label="ความชื้นเฉลี่ย" value={avgMoisture} />
        <Kpi label="มูลค่ารับซื้อวันนี้" value={formatBaht(receivedValue)} />
      </div>
      <div className="overflow-hidden rounded-[8px] border border-frame">
        <div className="bg-bar px-6 py-4 text-[16px] font-bold text-white">คิวตาชั่ง</div>
        <div className="flex items-end gap-1 px-4 pt-4">
          {(["ทั้งหมด", "รอชั่ง", "เข้าไซโล"] as TicketFilter[]).map((item) => (
            <StatusTab key={item} label={item} active={filter === item} onClick={() => setFilter(item)} />
          ))}
        </div>
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="bg-table">
            <tr>
              {["คิว", "ทะเบียน", "คู่ค้า", "พันธุ์", "ความชื้น", "น้ำหนักสุทธิ", "เป็นเงิน", ""].map((label) => (
                <th key={label} className="border-r border-white px-5 py-3 font-bold last:border-r-0">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket, index) => {
              const farmer = farmers.find((item) => item.id === ticket.farmerId);
              return (
                <tr key={ticket.id} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                  <td className="px-5 py-3 font-bold">{ticket.queue}</td>
                  <td className="px-5 py-3">{ticket.plate}</td>
                  <td className="px-5 py-3">{farmer ? farmerName(farmer) : "—"}</td>
                  <td className="px-5 py-3">{ticket.variety}</td>
                  <td className="px-5 py-3">{ticket.moisture == null ? "—" : `${ticket.moisture}%`}</td>
                  <td className="px-5 py-3">{ticket.netKg == null ? "—" : formatKg(ticket.netKg)}</td>
                  <td className="px-5 py-3">{ticket.amountBaht == null ? "—" : formatBaht(ticket.amountBaht)}</td>
                  <td className="px-5 py-3 text-right">
                    {ticket.status === "รอชั่ง" ? (
                      <PrimaryButton className="h-9" onClick={() => setWeighId(ticket.id)}>
                        ชั่ง
                      </PrimaryButton>
                    ) : (
                      <span className="text-[12px] font-bold text-ok">เข้าไซโล</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <CountBar count={rows.length} />
      </div>
      {creating && <CreateTicket onClose={() => setCreating(false)} onCreate={createTicket} />}
      {weighId && <WeighTicket id={weighId} onClose={() => setWeighId(null)} onWeigh={weighTicket} />}
    </div>
  );
}

function CreateTicket({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (farmerId: string, plate: string) => string | null;
}) {
  const [farmerId, setFarmerId] = useState("");
  const [plate, setPlate] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog title="เปิดตั๋วรับซื้อ" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!farmerId || !plate.trim()) {
            setError("เลือกคู่ค้าและกรอกทะเบียนรถ");
            return;
          }
          const message = onCreate(farmerId, plate.trim());
          if (message) {
            setError(message);
            return;
          }
          onClose();
        }}
      >
        <label className="block text-[14px] font-bold leading-[1.4]">
          คู่ค้า
          <div className="mt-1">
            <FarmerSelect value={farmerId} onChange={setFarmerId} />
          </div>
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          ทะเบียนรถ
          <input
            value={plate}
            onChange={(event) => setPlate(event.target.value)}
            placeholder="81-4521"
            className={`${inputClass} mt-1 ${error && !plate.trim() ? "border-danger" : ""}`}
          />
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">เปิดคิว</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}

function WeighTicket({
  id,
  onClose,
  onWeigh,
}: {
  id: string;
  onClose: () => void;
  onWeigh: (id: string, grossKg: number, moisture: number) => string | null;
}) {
  const { tickets, farmers } = useMill();
  const ticket = tickets.find((item) => item.id === id);
  const farmer = farmers.find((item) => item.id === ticket?.farmerId);
  const [gross, setGross] = useState("");
  const [moisture, setMoisture] = useState("");
  const [error, setError] = useState("");

  const preview = useMemo(() => {
    const grossKg = Number(gross);
    const moistureValue = Number(moisture);
    if (!ticket || !Number.isFinite(grossKg) || !Number.isFinite(moistureValue) || grossKg <= 0) return null;
    return settle(grossKg, moistureValue, ticket.pricePerKg);
  }, [gross, moisture, ticket]);

  if (!ticket || !farmer) return null;

  return (
    <Dialog title={`ชั่งคิว ${ticket.queue}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const grossKg = Number(gross);
          const moistureValue = Number(moisture);
          if (!Number.isFinite(grossKg) || grossKg <= 0 || !Number.isFinite(moistureValue) || moistureValue <= 0) {
            setError("กรอกน้ำหนักและความชื้น");
            return;
          }
          const message = onWeigh(ticket.id, grossKg, moistureValue);
          if (message) {
            setError(message);
            return;
          }
          onClose();
        }}
      >
        <p className="text-[14px]">
          {ticket.plate} · {farmerName(farmer)} · {ticket.variety} · ราคา {formatBaht(ticket.pricePerKg)} / กก.
        </p>
        <p className="text-[14px] text-ink/70">หัก 1% ของน้ำหนักต่อความชื้นที่เกิน 15%</p>
        <label className="block text-[14px] font-bold leading-[1.4]">
          น้ำหนักชั่ง (กก.)
          <input value={gross} onChange={(event) => setGross(event.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-[14px] font-bold leading-[1.4]">
          ความชื้น (%)
          <input value={moisture} onChange={(event) => setMoisture(event.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
        </label>
        {preview && (
          <div className="rounded-[8px] border border-frame bg-sub px-4 py-3 text-[14px]">
            <div>หักความชื้น {formatKg(preview.deductKg)}</div>
            <div className="mt-1 font-bold">สุทธิ {formatKg(preview.netKg)}</div>
            <div className="mt-1 font-bold">เป็นเงิน {formatBaht(preview.amountBaht)}</div>
          </div>
        )}
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <SecondaryButton onClick={onClose}>ยกเลิก</SecondaryButton>
          <PrimaryButton type="submit">รับเข้าไซโลชื้น</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
