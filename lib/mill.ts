export type Variety = 1 | 2 | 3;

export const VARIETIES: { id: Variety; name: string }[] = [
  { id: 1, name: "หอมมะลิ" },
  { id: 2, name: "ขาว" },
  { id: 3, name: "เหนียว" },
];

export function varietyName(id: number) {
  return VARIETIES.find((item) => item.id === id)?.name ?? "—";
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
  polygon: [number, number][];
};

export type Planting = {
  id: string;
  plotId: string;
  varietyId: Variety;
  plantedOn: string;
  harvestOn: string;
  estKg: number;
  delivered: boolean;
};

export type PermissionRole = "mill" | "leader" | "member";
export type PermissionResource = "groups" | "farmers" | "plots" | "plantings";
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

const FARMER_COLORS = ["#1A9D72", "#1D4F60", "#3B6787", "#6B5BA6", "#B7791F", "#0F766E"];

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
  return plantings.find((item) => item.plotId === plotId && !item.delivered) ?? null;
}

export function currentPlanting(plantings: Planting[], plotId: string) {
  return openPlanting(plantings, plotId) ?? plantingsOf(plantings, plotId)[0] ?? null;
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
