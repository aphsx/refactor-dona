"use client";

import { createContext, useContext, useRef, useState } from "react";
import {
  FARMERS,
  GROUPS,
  LOTS,
  PLANTINGS,
  PLOTS,
  SILOS,
  PRICES,
  TICKETS,
  isClosedRing,
  settle,
  splitLot,
  type Farmer,
  type Lot,
  type Planting,
  type Plot,
  type Silo,
  type SupplierGroup,
  type Ticket,
  type Variety,
} from "@/lib/mill";

type MillData = {
  farmers: Farmer[];
  groups: SupplierGroup[];
  plots: Plot[];
  plantings: Planting[];
  tickets: Ticket[];
  silos: Silo[];
  lots: Lot[];
};

type Store = MillData & {
  createTicket: (farmerId: string, plate: string, variety: Variety) => string | null;
  weighTicket: (id: string, grossKg: number, moisture: number) => string | null;
  dryPaddy: (wetSiloId: string, kg: number) => string | null;
  openLot: (drySiloId: string, kg: number) => string | null;
  closeLot: (lotId: string) => string | null;
  createGroup: (name: string, leaderId: string) => string | null;
  updateGroup: (groupId: string, name: string, leaderId: string) => string | null;
  updateFarmer: (
    farmerId: string,
    input: {
      firstName: string;
      lastName: string;
      tel: string;
      address: string;
      subdistrict: string;
      district: string;
      province: string;
      groupId: string | null;
    },
  ) => string | null;
  assignFarmer: (farmerId: string, groupId: string | null) => string | null;
  addPlot: (
    farmerId: string,
    input: {
      name: string;
      areaRai: number;
      variety: Variety;
      plantedOn: string;
      harvestOn: string;
      estKg: number;
      subdistrict: string;
      district: string;
      province: string;
      polygon: [number, number][];
    },
  ) => string | null;
  savePlot: (plotId: string, input: { name: string; areaRai: number; subdistrict?: string; district?: string; province?: string }) => string | null;
  saveBoundary: (plotId: string, polygon: [number, number][], areaRai: number) => string | null;
  removePlot: (plotId: string) => string | null;
  savePlanting: (
    plotId: string,
    input: { plantingId: string | null; variety: Variety; plantedOn: string; harvestOn: string; estKg: number },
  ) => string | null;
  removePlanting: (plantingId: string) => string | null;
};

const StoreContext = createContext<Store | null>(null);

const initialData: MillData = {
  farmers: FARMERS,
  groups: GROUPS,
  plots: PLOTS,
  plantings: PLANTINGS,
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
    createTicket(farmerId, plate, variety) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบคู่ค้า";
        if (!PRICES[variety]) return "เลือกพันธุ์";
        const queue = draft.tickets.reduce((max, ticket) => Math.max(max, ticket.queue), 0) + 1;
        draft.tickets.push({
          id: `t-${queue}`,
          queue,
          plate,
          farmerId,
          variety,
          status: "รอชั่ง",
          grossKg: null,
          moisture: null,
          netKg: null,
          pricePerKg: PRICES[variety],
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
        const id = `g-${draft.groups.length + 1}-${trimmed.length}`;
        draft.groups.push({ id, name: trimmed, leaderId });
        leader.groupId = id;
        return null;
      });
    },
    updateGroup(groupId, name, leaderId) {
      return commit((draft) => {
        const group = draft.groups.find((item) => item.id === groupId);
        if (!group) return "ไม่พบกลุ่ม";
        const trimmed = name.trim();
        if (!trimmed) return "กรอกชื่อกลุ่ม";
        const leader = draft.farmers.find((item) => item.id === leaderId);
        if (!leader || leader.groupId !== groupId) return "หัวหน้ากลุ่มต้องเป็นสมาชิกในกลุ่ม";
        if (draft.groups.some((item) => item.leaderId === leaderId && item.id !== groupId)) return "คนนี้เป็นหัวหน้ากลุ่มอยู่แล้ว";
        group.name = trimmed;
        group.leaderId = leaderId;
        return null;
      });
    },
    updateFarmer(farmerId, input) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบคู่ค้า";
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        const tel = input.tel.trim();
        if (!firstName || !lastName) return "กรอกชื่อ";
        if (!tel) return "กรอกเบอร์โทร";
        if (input.groupId !== farmer.groupId) {
          if (input.groupId == null) {
            if (draft.groups.some((group) => group.leaderId === farmerId)) return "หัวหน้ากลุ่มออกจากกลุ่มไม่ได้";
          } else {
            if (!draft.groups.some((group) => group.id === input.groupId)) return "ไม่พบกลุ่ม";
            if (draft.groups.some((group) => group.leaderId === farmerId && group.id !== input.groupId)) {
              return "ย้ายหัวหน้ากลุ่มไม่ได้";
            }
          }
          farmer.groupId = input.groupId;
        }
        farmer.firstName = firstName;
        farmer.lastName = lastName;
        farmer.tel = tel;
        farmer.address = input.address.trim();
        farmer.subdistrict = input.subdistrict.trim();
        farmer.district = input.district.trim();
        farmer.province = input.province.trim();
        return null;
      });
    },
    assignFarmer(farmerId, groupId) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบคู่ค้า";
        if (groupId == null) {
          if (draft.groups.some((group) => group.leaderId === farmerId)) return "หัวหน้ากลุ่มออกจากกลุ่มไม่ได้";
          farmer.groupId = null;
          return null;
        }
        if (!draft.groups.some((group) => group.id === groupId)) return "ไม่พบกลุ่ม";
        if (draft.groups.some((group) => group.leaderId === farmerId && group.id !== groupId)) {
          return "ย้ายหัวหน้ากลุ่มไม่ได้";
        }
        farmer.groupId = groupId;
        return null;
      });
    },
    addPlot(farmerId, input) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบคู่ค้า";
        const name = input.name.trim();
        if (!name) return "กรอกชื่อแปลง";
        if (!validArea(input.areaRai)) return "พื้นที่ต้องมากกว่า 0";
        const subdistrict = input.subdistrict.trim();
        const district = input.district.trim();
        const province = input.province.trim();
        if (!subdistrict || !district || !province) return "กรอกตำบล อำเภอ และจังหวัด";
        if (input.polygon.length > 0 && !isClosedRing(input.polygon)) return "รูปแปลงต้องมีอย่างน้อย 3 จุด";
        const plotId = `p-${draft.plots.length + 1}-${name.length}`;
        draft.plots.push({
          id: plotId,
          farmerId,
          name,
          areaRai: input.areaRai,
          subdistrict,
          district,
          province,
          polygon: input.polygon,
        });
        if (!input.plantedOn && !input.harvestOn) return null;
        if (!PRICES[input.variety]) return "เลือกพันธุ์";
        const schedule = validSchedule(name, input);
        if (schedule) return schedule;
        draft.plantings.push({
          id: `r-${draft.plantings.length + 1}`,
          plotId,
          variety: input.variety,
          plantedOn: input.plantedOn,
          harvestOn: input.harvestOn,
          estKg: input.estKg,
          delivered: false,
        });
        return null;
      });
    },
    savePlot(plotId, input) {
      return commit((draft) => {
        const plot = draft.plots.find((item) => item.id === plotId);
        if (!plot) return "ไม่พบแปลง";
        const name = input.name.trim();
        if (!name) return "กรอกชื่อแปลง";
        if (!validArea(input.areaRai)) return "พื้นที่ต้องมากกว่า 0";
        plot.name = name;
        plot.areaRai = input.areaRai;
        if (input.subdistrict != null) plot.subdistrict = input.subdistrict.trim();
        if (input.district != null) plot.district = input.district.trim();
        if (input.province != null) plot.province = input.province.trim();
        return null;
      });
    },
    saveBoundary(plotId, polygon, areaRai) {
      return commit((draft) => {
        const plot = draft.plots.find((item) => item.id === plotId);
        if (!plot) return "ไม่พบแปลง";
        if (polygon.length < 4 || polygon[0][0] !== polygon[polygon.length - 1][0] || polygon[0][1] !== polygon[polygon.length - 1][1]) {
          return "รูปแปลงต้องมีอย่างน้อย 3 จุด";
        }
        if (!validArea(areaRai)) return "พื้นที่ต้องมากกว่า 0";
        plot.polygon = polygon;
        plot.areaRai = areaRai;
        return null;
      });
    },
    removePlot(plotId) {
      return commit((draft) => {
        const plot = draft.plots.find((item) => item.id === plotId);
        if (!plot) return "ไม่พบแปลง";
        if (draft.plantings.some((item) => item.plotId === plotId && item.delivered)) return "แปลงนี้มีรอบที่รับแล้ว ลบไม่ได้";
        draft.plots = draft.plots.filter((item) => item.id !== plotId);
        draft.plantings = draft.plantings.filter((item) => item.plotId !== plotId);
        return null;
      });
    },
    savePlanting(plotId, input) {
      return commit((draft) => {
        const plot = draft.plots.find((item) => item.id === plotId);
        if (!plot) return "ไม่พบแปลง";
        const schedule = validSchedule(plot.name, input);
        if (schedule) return schedule;
        if (!PRICES[input.variety]) return "เลือกพันธุ์";
        if (input.plantingId == null) {
          if (draft.plantings.some((item) => item.plotId === plotId && !item.delivered)) return "แปลงนี้มีแผนที่ยังไม่รับ";
          draft.plantings.push({
            id: `r-${draft.plantings.length + 1}`,
            plotId,
            variety: input.variety,
            plantedOn: input.plantedOn,
            harvestOn: input.harvestOn,
            estKg: input.estKg,
            delivered: false,
          });
          return null;
        }
        const planting = draft.plantings.find((item) => item.id === input.plantingId);
        if (!planting || planting.plotId !== plotId) return "ไม่พบแผน";
        if (planting.delivered) return "รอบนี้รับเข้าแล้ว แก้ไม่ได้";
        planting.variety = input.variety;
        planting.plantedOn = input.plantedOn;
        planting.harvestOn = input.harvestOn;
        planting.estKg = input.estKg;
        return null;
      });
    },
    removePlanting(plantingId) {
      return commit((draft) => {
        const planting = draft.plantings.find((item) => item.id === plantingId);
        if (!planting) return "ไม่พบแผน";
        if (planting.delivered) return "รอบนี้รับเข้าแล้ว ลบไม่ได้";
        draft.plantings = draft.plantings.filter((item) => item.id !== plantingId);
        return null;
      });
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validArea(areaRai: number) {
  return Number.isFinite(areaRai) && areaRai > 0;
}

function validSchedule(name: string, input: { plantedOn: string; harvestOn: string; estKg: number }) {
  if (!isoDate(input.plantedOn)) return `วันปลูกของ ${name} ไม่ถูกต้อง`;
  if (!isoDate(input.harvestOn)) return `กำหนดเก็บของ ${name} ไม่ถูกต้อง`;
  if (input.harvestOn < input.plantedOn) return `กำหนดเก็บของ ${name} ต้องไม่ก่อนวันปลูก`;
  if (!Number.isInteger(input.estKg) || input.estKg <= 0) return `ที่คาดของ ${name} ต้องมากกว่า 0`;
  return null;
}

export function useMill() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useMill must be used inside StoreProvider");
  return store;
}
