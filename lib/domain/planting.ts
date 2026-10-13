import { varietyName, type Variety } from "./catalog";
import { formatRai } from "./plot";
import type { Plot } from "./plot";

export type Planting = {
  id: string;
  plotId: string;
  varietyId: Variety;
  plantedOn: string;
  harvestOn: string;
  estKg: number;
  createdAt?: string;
  updatedAt?: string;
  /** Present on list responses so a date window can render without loading every plot. */
  plotName?: string;
  areaRai?: number;
  farmerId?: string;
  farmerName?: string;
  farmerTel?: string;
  groupId?: string | null;
  groupName?: string;
  plantedAreaRai?: number;
  stage?: string;
};

export type PlotActivityType =
  | "seed_receive"
  | "plant_actual"
  | "fertilizer_receive"
  | "fertilizer_apply"
  | "chemical"
  | "problem";

export type SeedReceivePayload = {
  varietyId: Variety;
  quantityKg: number;
  intendedAreaRai: number;
};

export type PlantActualPayload = {
  plantedAreaRai: number;
};

export type FertilizerReceivePayload = {
  product: string;
  quantityKg: number;
};

export type FertilizerApplyPayload = {
  round: number;
  brand: string;
  rateKgPerRai: number;
};

export type ChemicalPayload = {
  round: number;
  name: string;
  details: string;
};

export type ProblemPayload = {
  details: string;
};

export type PlotActivityPayload =
  | SeedReceivePayload
  | PlantActualPayload
  | FertilizerReceivePayload
  | FertilizerApplyPayload
  | ChemicalPayload
  | ProblemPayload;

export type PlotActivity = {
  id: string;
  plantingId: string;
  type: PlotActivityType;
  occurredOn: string;
  payload: PlotActivityPayload;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Full labels — seed/plant stay on แผนรอบ, not the activity picker. */
export const ACTIVITY_TYPE_LABELS: Record<PlotActivityType, string> = {
  seed_receive: "รับเมล็ดพันธุ์",
  plant_actual: "ปลูกจริง",
  fertilizer_receive: "รับปุ๋ย",
  fertilizer_apply: "ใส่ปุ๋ยจริง",
  chemical: "ใช้สารเคมี",
  problem: "ปัญหาในแปลง",
};

/** Types that appear on Timeline / ปุ่มเพิ่มกิจกรรม */
export const TIMELINE_ACTIVITY_TYPES: { id: PlotActivityType; label: string; shortLabel: string }[] = [
  { id: "fertilizer_receive", label: ACTIVITY_TYPE_LABELS.fertilizer_receive, shortLabel: "รับปุ๋ย" },
  { id: "fertilizer_apply", label: ACTIVITY_TYPE_LABELS.fertilizer_apply, shortLabel: "ใส่ปุ๋ย" },
  { id: "chemical", label: ACTIVITY_TYPE_LABELS.chemical, shortLabel: "สารเคมี" },
  { id: "problem", label: ACTIVITY_TYPE_LABELS.problem, shortLabel: "ปัญหา" },
];

export const ACTIVITY_TYPES = TIMELINE_ACTIVITY_TYPES;

export function activityTypeLabel(type: PlotActivityType) {
  return ACTIVITY_TYPE_LABELS[type] ?? type;
}

export function activitiesOf(activities: PlotActivity[], plantingId: string) {
  return activities
    .filter((item) => item.plantingId === plantingId)
    .slice()
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function timelineActivitiesOf(activities: PlotActivity[], plantingId: string) {
  return activitiesOf(activities, plantingId).filter(
    (item) => item.type !== "seed_receive" && item.type !== "plant_actual",
  );
}

export function latestActivityOfType(activities: PlotActivity[], plantingId: string, type: PlotActivityType) {
  const rows = activitiesOf(activities, plantingId).filter((item) => item.type === type);
  return rows[rows.length - 1] ?? null;
}

export function plantingsOf(plantings: Planting[], plotId: string) {
  return plantings.filter((item) => item.plotId === plotId).sort((a, b) => b.plantedOn.localeCompare(a.plantedOn) || b.id.localeCompare(a.id));
}

export function openPlanting(plantings: Planting[], plotId: string) {
  return plantingsOf(plantings, plotId)[0] ?? null;
}

export function currentPlanting(plantings: Planting[], plotId: string) {
  return openPlanting(plantings, plotId) ?? plantingsOf(plantings, plotId)[0] ?? null;
}

export function plantingAreaSummary(plotAreaRai: number, activities: PlotActivity[], plantingId: string) {
  const rows = activitiesOf(activities, plantingId);
  let plantedAreaRai = 0;
  let actuallyPlantedOn: string | null = null;
  for (const row of rows) {
    if (row.type === "plant_actual") {
      const payload = row.payload as PlantActualPayload;
      if (typeof payload.plantedAreaRai === "number" && payload.plantedAreaRai > 0) {
        plantedAreaRai = payload.plantedAreaRai;
        actuallyPlantedOn = row.occurredOn;
      }
    }
  }
  const intendedAreaRai = plotAreaRai;
  const unplantedAreaRai = Math.max(0, Math.round((intendedAreaRai - plantedAreaRai) * 100) / 100);
  return { intendedAreaRai, plantedAreaRai, unplantedAreaRai, actuallyPlantedOn };
}

export function currentActivityStage(activities: PlotActivity[], plantingId: string) {
  const rows = timelineActivitiesOf(activities, plantingId);
  if (rows.length > 0) {
    const latest = rows[rows.length - 1];
    if (latest.type === "fertilizer_apply") {
      const round = (latest.payload as FertilizerApplyPayload).round;
      return `ใส่ปุ๋ยครั้งที่ ${round}`;
    }
    if (latest.type === "chemical") {
      const round = (latest.payload as ChemicalPayload).round;
      return `ใช้สารเคมีครั้งที่ ${round}`;
    }
    return activityTypeLabel(latest.type);
  }
  if (latestActivityOfType(activities, plantingId, "plant_actual")) return "ปลูกแล้ว";
  if (latestActivityOfType(activities, plantingId, "seed_receive")) return "รับเมล็ดแล้ว";
  return "ยังไม่มีกิจกรรม";
}

export function nextActivityRound(activities: PlotActivity[], plantingId: string, type: "fertilizer_apply" | "chemical") {
  const rounds = activitiesOf(activities, plantingId)
    .filter((item) => item.type === type)
    .map((item) => Number((item.payload as FertilizerApplyPayload | ChemicalPayload).round) || 0);
  return rounds.length === 0 ? 1 : Math.max(...rounds) + 1;
}

export function activitySummary(activity: PlotActivity) {
  switch (activity.type) {
    case "seed_receive": {
      const payload = activity.payload as SeedReceivePayload;
      return `${varietyName(payload.varietyId)} · ${payload.quantityKg} กก. · ตั้งใจ ${formatRai(payload.intendedAreaRai)}`;
    }
    case "plant_actual": {
      const payload = activity.payload as PlantActualPayload;
      return `ปลูกจริง ${formatRai(payload.plantedAreaRai)}`;
    }
    case "fertilizer_receive": {
      const payload = activity.payload as FertilizerReceivePayload;
      return `${payload.product} · ${payload.quantityKg} กก.`;
    }
    case "fertilizer_apply": {
      const payload = activity.payload as FertilizerApplyPayload;
      return `ครั้งที่ ${payload.round} · ${payload.brand} · ${payload.rateKgPerRai} กก./ไร่`;
    }
    case "chemical": {
      const payload = activity.payload as ChemicalPayload;
      return `ครั้งที่ ${payload.round} · ${payload.name}`;
    }
    case "problem": {
      const payload = activity.payload as ProblemPayload;
      return payload.details;
    }
    default:
      return "—";
  }
}

export function farmerVarieties(plots: Plot[], plantings: Planting[], farmerId: string) {
  const ids = new Set(plots.filter((plot) => plot.farmerId === farmerId).map((plot) => plot.id));
  const names = [...new Set(plantings.filter((planting) => ids.has(planting.plotId)).map((planting) => varietyName(planting.varietyId)))];
  return names.length === 0 ? "—" : names.join(" · ");
}

