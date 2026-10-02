"use client";

import { createContext, useContext, useRef, useState } from "react";
import {
  FARMERS,
  GROUPS,
  PLANTINGS,
  PLOTS,
  VARIETIES,
  isClosedRing,
  type Farmer,
  type Planting,
  type Plot,
  type SupplierGroup,
  type Variety,
} from "@/lib/mill";

type MillData = {
  farmers: Farmer[];
  groups: SupplierGroup[];
  plots: Plot[];
  plantings: Planting[];
};

type Store = MillData & {
  createGroup: (name: string, leaderId: string) => string | null;
  updateGroup: (groupId: string, name: string, leaderId: string) => string | null;
  createFarmer: (input: {
    firstName: string;
    lastName: string;
    tel: string;
    address: string;
    subdistrict: string;
    district: string;
    province: string;
    groupId: string | null;
  }) => string | null;
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
    createFarmer(input) {
      return commit((draft) => {
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        const tel = input.tel.trim();
        if (!firstName || !lastName) return "กรอกชื่อ";
        if (!tel) return "กรอกเบอร์โทร";
        if (!input.address.trim()) return "กรอกที่อยู่";
        if (input.groupId != null && !draft.groups.some((group) => group.id === input.groupId)) return "ไม่พบกลุ่ม";
        draft.farmers.push({
          id: `f-${draft.farmers.length + 1}`,
          firstName,
          lastName,
          tel,
          address: input.address.trim(),
          subdistrict: input.subdistrict.trim(),
          district: input.district.trim(),
          province: input.province.trim(),
          groupId: input.groupId,
          deliveredKg: 0,
        });
        return null;
      });
    },
    updateFarmer(farmerId, input) {
      return commit((draft) => {
        const farmer = draft.farmers.find((item) => item.id === farmerId);
        if (!farmer) return "ไม่พบเกษตรกร";
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        const tel = input.tel.trim();
        if (!firstName || !lastName) return "กรอกชื่อ";
        if (!tel) return "กรอกเบอร์โทร";
        if (!input.address.trim()) return "กรอกที่อยู่";
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
        if (!farmer) return "ไม่พบเกษตรกร";
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
        if (!farmer) return "ไม่พบเกษตรกร";
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
        if (!VARIETIES.includes(input.variety)) return "เลือกพันธุ์";
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
        if (!VARIETIES.includes(input.variety)) return "เลือกพันธุ์";
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
  if (input.estKg !== 0 && (!Number.isInteger(input.estKg) || input.estKg <= 0)) return `ที่คาดของ ${name} ต้องมากกว่า 0`;
  return null;
}

export function useMill() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useMill must be used inside StoreProvider");
  return store;
}
