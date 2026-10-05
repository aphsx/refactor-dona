/** Variety id from API (`varieties.id`). */
export type Variety = number;

export type VarietyItem = {
  id: number;
  name: string;
};

/** Product kind id from API (`product_kinds.id`). */
export type ProductKind = number;

export type ProductKindItem = {
  id: number;
  name: string;
};

/** Seed defaults until snapshot loads; kept in sync by loadMillSnapshot. */
export let VARIETIES: VarietyItem[] = [
  { id: 1, name: "หอมมะลิ" },
  { id: 2, name: "ขาว" },
  { id: 3, name: "เหนียว" },
];

/** Seed defaults: 1=ข้าวเปลือก 2=เมล็ดพันธุ์ */
export let PRODUCT_KINDS: ProductKindItem[] = [
  { id: 1, name: "ข้าวเปลือก" },
  { id: 2, name: "เมล็ดพันธุ์" },
];

export function syncVarieties(items: VarietyItem[]) {
  if (items.length > 0) VARIETIES = items;
}

export function syncProductKinds(items: ProductKindItem[]) {
  if (items.length > 0) PRODUCT_KINDS = items;
}

export function varietyName(id: number) {
  return VARIETIES.find((item) => item.id === id)?.name ?? "—";
}

export function productKindName(id: number) {
  return PRODUCT_KINDS.find((item) => item.id === id)?.name ?? "—";
}

export function defaultVarietyId(varieties: VarietyItem[] = VARIETIES) {
  return varieties[0]?.id ?? 1;
}

export type Farmer = {
  id: string;
  firstName: string;
  lastName: string;
  tel: string;
  address: string;
  provinceId: number;
  districtId: number;
  subdistrictId: number;
  groupId: string | null;
  deliveredKg: number;
  avatarUrl?: string | null;
};

export type SupplierGroup = {
  id: string;
  name: string;
  leaderId: string;
};

export type Plot = {
  id: string;
  farmerId: string;
  name: string;
  areaRai: number;
  provinceId: number;
  districtId: number;
  subdistrictId: number;
  previewUrl?: string | null;
  /** True when a boundary exists server-side; list payloads omit the ring. */
  hasBoundary?: boolean;
  polygon: [number, number][];
};

/** Map payload from GET /plots/boundaries — name + ring only. */
export type PlotBoundary = {
  id: string;
  farmerId: string;
  name: string;
  polygon: [number, number][];
};

export type Planting = {
  id: string;
  plotId: string;
  varietyId: Variety;
  plantedOn: string;
  harvestOn: string;
  estKg: number;
};

/**
 * Mill ledger for a farmer — not tied to a plot.
 * in     = รับซื้อเข้า
 * out    = ขายออก
 * lend   = ให้ยืม (ให้ไปปลูกก่อน)
 * return = รับคืน (คืนยืม)
 *
 * Variety (พันธุ์ข้าว) is separate from product kind (ชนิดสินค้า).
 */
export type MillReceiptDirection = "in" | "out" | "lend" | "return";

export type MillReceipt = {
  id: string;
  farmerId: string;
  varietyId: Variety;
  productKindId: ProductKind;
  direction: MillReceiptDirection;
  kg: number;
  receivedOn: string;
};

export function millReceiptDirectionLabel(direction: MillReceiptDirection) {
  if (direction === "out") return "ขายออก";
  if (direction === "lend") return "ให้ยืม";
  if (direction === "return") return "รับคืน";
  return "รับซื้อเข้า";
}

export function asMillReceiptDirection(value: string | undefined): MillReceiptDirection {
  if (value === "out" || value === "lend" || value === "return") return value;
  return "in";
}

export function defaultProductKindId(
  direction: MillReceiptDirection,
  productKinds: ProductKindItem[] = PRODUCT_KINDS,
): ProductKind {
  const preferSeed = direction === "lend" || direction === "return";
  const byName = productKinds.find((item) => item.name === (preferSeed ? "เมล็ดพันธุ์" : "ข้าวเปลือก"));
  if (byName) return byName.id;
  if (preferSeed) return productKinds[1]?.id ?? productKinds[0]?.id ?? 2;
  return productKinds[0]?.id ?? 1;
}

export type PlotActivityType =
  | "seed_receive"
  | "plant_actual"
  | "fertilizer_receive"
  | "fertilizer_apply"
  | "chemical"
  | "problem";

export type SeedReceivePayload = {
  varietyId: number;
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

export function timelineActivitiesOf(activities: PlotActivity[], plantingId: string) {
  return activitiesOf(activities, plantingId).filter(
    (item) => item.type !== "seed_receive" && item.type !== "plant_actual",
  );
}

export function latestActivityOfType(activities: PlotActivity[], plantingId: string, type: PlotActivityType) {
  const rows = activitiesOf(activities, plantingId).filter((item) => item.type === type);
  return rows[rows.length - 1] ?? null;
}

export type PermissionRole = "mill" | "leader" | "member";
export type PermissionResource =
  | "groups"
  | "farmers"
  | "plots"
  | "plantings"
  | "activities"
  | "varieties"
  | "productKinds";
export type PermissionFlag = "canRead" | "canAdd" | "canEdit" | "canDelete";

export type Permission = {
  role: PermissionRole;
  resource: PermissionResource;
  scope: "all" | "group" | "own";
  canRead: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type RoleGrant = {
  farmerId: string;
  role: "mill";
};

export type MillSnapshot = {
  farmers: Farmer[];
  groups: SupplierGroup[];
  plots: Plot[];
  plantings: Planting[];
  activities: PlotActivity[];
  receipts: MillReceipt[];
  varieties: VarietyItem[];
  productKinds: ProductKindItem[];
  permissions: Permission[];
  roleGrants: RoleGrant[];
};

export type FarmerInput = Omit<Farmer, "id" | "deliveredKg">;

export function personRole(grants: RoleGrant[], groups: SupplierGroup[], farmerId: string): PermissionRole {
  if (grants.some((grant) => grant.farmerId === farmerId && grant.role === "mill")) return "mill";
  if (groups.some((group) => group.leaderId === farmerId)) return "leader";
  return "member";
}

export function roleTitle(role: PermissionRole) {
  if (role === "mill") return "โรงสี";
  if (role === "leader") return "หัวหน้ากลุ่ม";
  return "สมาชิก";
}

export function allowed(
  permissions: Permission[],
  role: PermissionRole,
  resource: PermissionResource,
  flag: PermissionFlag,
) {
  if (permissions.some((item) => item.role === role && item.resource === resource && item[flag])) return true;
  if (role === "leader" && permissions.some((item) => item.role === "member" && item.resource === resource && item[flag])) {
    return true;
  }
  return false;
}

export function farmerVarieties(plots: Plot[], plantings: Planting[], farmerId: string) {
  const ids = new Set(plots.filter((plot) => plot.farmerId === farmerId).map((plot) => plot.id));
  const names = [...new Set(plantings.filter((planting) => ids.has(planting.plotId)).map((planting) => varietyName(planting.varietyId)))];
  return names.length === 0 ? "—" : names.join(" · ");
}

export function farmerName(farmer: Farmer) {
  return `${farmer.firstName} ${farmer.lastName}`;
}

export function canonicalPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (!/^0[689]\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function farmerHandle(farmer: Farmer) {
  return `${farmerName(farmer)} · ${farmer.tel}`;
}

export function daysUntil(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function formatThaiDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatThaiMonth(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

const FARMER_COLORS = ["#5098BA", "#005983", "#024F7B", "#22759C", "#18B473", "#6B8F9E"];

export function farmerColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return FARMER_COLORS[hash % FARMER_COLORS.length];
}

export function formatKg(kg: number) {
  return `${new Intl.NumberFormat("th-TH").format(Math.round(kg))} กก.`;
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

export function activitiesOf(activities: PlotActivity[], plantingId: string) {
  return activities
    .filter((item) => item.plantingId === plantingId)
    .slice()
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
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

export function centroid(points: [number, number][]) {
  const ring = openRing(points);
  const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
  const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  return { lng, lat };
}

export function openRing(points: [number, number][]) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points.slice(0, -1);
  return points;
}

export function isClosedRing(points: [number, number][]) {
  return points.length >= 4 && openRing(points).length === points.length - 1;
}

export function closeRing(points: [number, number][]) {
  const ring = openRing(points);
  if (ring.length < 3) return null;
  return [...ring, ring[0]] as [number, number][];
}

/** Local fallback only. Prefer api.measureArea (PostGIS geography / WGS84 spheroid). */
export function polygonAreaRai(points: [number, number][]) {
  const ring = openRing(points);
  if (ring.length < 3) return null;
  const lat0 = (ring.reduce((sum, point) => sum + point[1], 0) / ring.length) * (Math.PI / 180);
  const metersPerLng = (Math.PI / 180) * 6378137 * Math.cos(lat0);
  const metersPerLat = (Math.PI / 180) * 6378137;
  let sum = 0;
  for (let index = 0; index < ring.length; index++) {
    const [lng1, lat1] = ring[index];
    const [lng2, lat2] = ring[(index + 1) % ring.length];
    sum += lng1 * metersPerLng * lat2 * metersPerLat - lng2 * metersPerLng * lat1 * metersPerLat;
  }
  return Math.round((Math.abs(sum) / 2 / 1600) * 100) / 100;
}

export function formatRai(rai: number) {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(rai)} ไร่`;
}

export function formatCoord(point: { lng: number; lat: number }) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}
