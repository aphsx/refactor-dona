"use client";

import { createContext, useContext, useRef, useState } from "react";
import {
  FARMERS,
  GROUPS,
  LOTS,
  PLOTS,
  SILOS,
  SUBGROUPS,
  PRICES,
  TICKETS,
  settle,
  splitLot,
  type Farmer,
  type Lot,
  type Plot,
  type Silo,
  type Subgroup,
  type SupplierGroup,
  type Ticket,
} from "@/lib/mill";

type MillData = {
  farmers: Farmer[];
  groups: SupplierGroup[];
  subgroups: Subgroup[];
  plots: Plot[];
  tickets: Ticket[];
  silos: Silo[];
  lots: Lot[];
};

type Store = MillData & {
  createTicket: (farmerId: string, plate: string) => string | null;
  weighTicket: (id: string, grossKg: number, moisture: number) => string | null;
  dryPaddy: (wetSiloId: string, kg: number) => string | null;
  openLot: (drySiloId: string, kg: number) => string | null;
  closeLot: (lotId: string) => string | null;
  createGroup: (name: string, leaderId: string) => string | null;
  createSubgroup: (groupId: string, name: string, leaderId: string) => string | null;
  assignFarmer: (farmerId: string, groupId: string | null, subgroupId: string | null) => string | null;
};

const StoreContext = createContext<Store | null>(null);

const initialData: MillData = {
  farmers: FARMERS,
  groups: GROUPS,
  subgroups: SUBGROUPS,
  plots: PLOTS,
  tickets: TICKETS,
  silos: SILOS,
  lots: LOTS,
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MillData>(initialData);
  const dataRef = useRef(data);
  dataRef.current = data;

  function commit(change: (draft: MillData) => string | null) {
    const next = structuredClone(dataRef.current);
    const error = change(next);
    if (error) return error;
    dataRef.current = next;
    setData(next);
    return null;
  }

  const store: Store = {
    ...data,
    createTicket(farmerId, plate) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบคู่ค้า";
        const queue = draft.tickets.reduce((max, ticket) => Math.max(max, ticket.queue), 0) + 1;
        draft.tickets.push({
          id: `t-${queue}`,
          queue,
          plate,
          farmerId,
          variety: farmer.variety,
          status: "รอชั่ง",
          grossKg: null,
          moisture: null,
          netKg: null,
          pricePerKg: PRICES[farmer.variety],
          amountBaht: null,
        });
        return null;
      });
    },
    weighTicket(id, grossKg, moisture) {
      return commit((draft) => {
        const ticket = draft.tickets.find((item) => item.id === id);
        if (!ticket || ticket.status !== "รอชั่ง") return "ตั๋วนี้ชั่งไปแล้ว";
        const wet = draft.silos.find((silo) => silo.stage === "ชื้น" && silo.variety === ticket.variety);
        if (!wet) return "ไม่มีไซโลชื้นของพันธุ์นี้";
        const result = settle(grossKg, moisture, ticket.pricePerKg);
        if (wet.kg + result.netKg > wet.capacityKg) return `${wet.name} รับเพิ่มไม่ไหว`;
        ticket.grossKg = grossKg;
        ticket.moisture = moisture;
        ticket.netKg = result.netKg;
        ticket.amountBaht = result.amountBaht;
        ticket.status = "เข้าไซโล";
        wet.kg += result.netKg;
        const farmer = draft.farmers.find((item) => item.id === ticket.farmerId);
        if (farmer) {
          farmer.deliveredKg += result.netKg;
          farmer.unpaidBaht += result.amountBaht;
        }
        return null;
      });
    },
    dryPaddy(wetSiloId, kg) {
      return commit((draft) => {
        const wet = draft.silos.find((silo) => silo.id === wetSiloId);
        if (!wet || wet.stage !== "ชื้น") return "เลือกไซโลชื้น";
        if (kg > wet.kg) return "ปริมาณเกินของในไซโล";
        const dry = draft.silos.find((silo) => silo.stage === "แห้ง" && silo.variety === wet.variety);
        if (!dry) return "ไม่มีไซโลแห้งของพันธุ์นี้";
        if (dry.kg + kg > dry.capacityKg) return `${dry.name} รับเพิ่มไม่ไหว`;
        wet.kg -= kg;
        dry.kg += kg;
        return null;
      });
    },
    openLot(drySiloId, kg) {
      return commit((draft) => {
        const dry = draft.silos.find((silo) => silo.id === drySiloId);
        if (!dry || dry.stage !== "แห้ง") return "เลือกไซโลแห้ง";
        if (dry.variety === "รวม") return "ไซโลนี้ไม่ใช่ข้าวเปลือก";
        if (kg > dry.kg) return "ปริมาณเกินของในไซโล";
        dry.kg -= kg;
        const number = draft.lots.length + 1;
        draft.lots.unshift({
          id: `lot-${number}-${kg}`,
          code: `ส-260${number}`,
          variety: dry.variety,
          inputKg: kg,
          status: "สีอยู่",
          headKg: null,
          brokenKg: null,
          branKg: null,
          huskKg: null,
        });
        return null;
      });
    },
    closeLot(lotId) {
      return commit((draft) => {
        const lot = draft.lots.find((item) => item.id === lotId);
        if (!lot || lot.status !== "สีอยู่") return "ล็อตนี้ปิดแล้ว";
        const parts = splitLot(lot.inputKg);
        const head = draft.silos.find((silo) => silo.stage === "ต้นข้าว" && silo.variety === lot.variety);
        const broken = draft.silos.find((silo) => silo.stage === "ข้าวหัก");
        const bran = draft.silos.find((silo) => silo.stage === "รำ");
        if (!head || !broken || !bran) return "โกดังผลผลิตไม่ครบ";
        if (head.kg + parts.headKg > head.capacityKg) return `${head.name} เต็ม`;
        if (broken.kg + parts.brokenKg > broken.capacityKg) return `${broken.name} เต็ม`;
        if (bran.kg + parts.branKg > bran.capacityKg) return `${bran.name} เต็ม`;
        head.kg += parts.headKg;
        broken.kg += parts.brokenKg;
        bran.kg += parts.branKg;
        lot.headKg = parts.headKg;
        lot.brokenKg = parts.brokenKg;
        lot.branKg = parts.branKg;
        lot.huskKg = parts.huskKg;
        lot.status = "ปิดแล้ว";
        return null;
      });
    },
    createGroup(name, leaderId) {
      return commit((draft) => {
        const trimmed = name.trim();
        if (!trimmed) return "กรอกชื่อกลุ่ม";
        const leader = draft.farmers.find((item) => item.id === leaderId);
        if (!leader) return "เลือกหัวหน้ากลุ่ม";
        if (draft.groups.some((group) => group.leaderId === leaderId)) return "คนนี้เป็นหัวหน้ากลุ่มอยู่แล้ว";
        if (draft.subgroups.some((item) => item.leaderId === leaderId)) return "คนนี้เป็นหัวหน้ากลุ่มย่อยอยู่แล้ว";
        const id = `g-${draft.groups.length + 1}-${trimmed.length}`;
        draft.groups.push({ id, name: trimmed, leaderId });
        leader.groupId = id;
        leader.subgroupId = null;
        return null;
      });
    },
    createSubgroup(groupId, name, leaderId) {
      return commit((draft) => {
        const trimmed = name.trim();
        if (!trimmed) return "กรอกชื่อกลุ่มย่อย";
        if (!draft.groups.some((group) => group.id === groupId)) return "ไม่พบกลุ่ม";
        const leader = draft.farmers.find((item) => item.id === leaderId);
        if (!leader) return "เลือกหัวหน้ากลุ่มย่อย";
        if (leader.groupId !== groupId) return "หัวหน้ากลุ่มย่อยต้องอยู่ในกลุ่มนี้";
        if (draft.subgroups.some((item) => item.leaderId === leaderId)) return "คนนี้เป็นหัวหน้ากลุ่มย่อยอยู่แล้ว";
        const id = `sg-${draft.subgroups.length + 1}`;
        draft.subgroups.push({ id, groupId, name: trimmed, leaderId });
        leader.subgroupId = id;
        return null;
      });
    },
    assignFarmer(farmerId, groupId, subgroupId) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบคู่ค้า";
        if (groupId == null) {
          if (draft.groups.some((group) => group.leaderId === farmerId)) return "หัวหน้ากลุ่มออกจากกลุ่มไม่ได้";
          if (draft.subgroups.some((item) => item.leaderId === farmerId)) return "หัวหน้ากลุ่มย่อยออกจากกลุ่มไม่ได้";
          farmer.groupId = null;
          farmer.subgroupId = null;
          return null;
        }
        if (!draft.groups.some((group) => group.id === groupId)) return "ไม่พบกลุ่ม";
        if (draft.groups.some((group) => group.leaderId === farmerId && group.id !== groupId)) {
          return "ย้ายหัวหน้ากลุ่มไม่ได้";
        }
        if (subgroupId) {
          const subgroup = draft.subgroups.find((item) => item.id === subgroupId);
          if (!subgroup || subgroup.groupId !== groupId) return "กลุ่มย่อยไม่ได้อยู่ในกลุ่มนี้";
        }
        if (draft.subgroups.some((item) => item.leaderId === farmerId && item.id !== subgroupId)) {
          return "ย้ายหัวหน้ากลุ่มย่อยไม่ได้";
        }
        farmer.groupId = groupId;
        farmer.subgroupId = subgroupId;
        return null;
      });
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useMill() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useMill must be used inside StoreProvider");
  return store;
}
