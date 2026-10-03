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
  subdistrict: string;
  district: string;
  province: string;
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
  subdistrict: string;
  district: string;
  province: string;
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

export const PERMISSIONS: Permission[] = [
  { role: "mill", resource: "groups", scope: "all", canRead: true, canAdd: true, canEdit: true, canDelete: true },
  { role: "mill", resource: "farmers", scope: "all", canRead: true, canAdd: true, canEdit: true, canDelete: true },
  { role: "mill", resource: "plots", scope: "all", canRead: true, canAdd: true, canEdit: true, canDelete: true },
  { role: "mill", resource: "plantings", scope: "all", canRead: true, canAdd: true, canEdit: true, canDelete: true },
  { role: "leader", resource: "groups", scope: "group", canRead: true, canAdd: false, canEdit: true, canDelete: false },
  { role: "leader", resource: "farmers", scope: "group", canRead: true, canAdd: false, canEdit: false, canDelete: false },
  { role: "leader", resource: "plots", scope: "group", canRead: true, canAdd: false, canEdit: false, canDelete: false },
  { role: "leader", resource: "plantings", scope: "group", canRead: true, canAdd: false, canEdit: false, canDelete: false },
  { role: "member", resource: "groups", scope: "own", canRead: true, canAdd: false, canEdit: false, canDelete: false },
  { role: "member", resource: "farmers", scope: "own", canRead: true, canAdd: false, canEdit: true, canDelete: false },
  { role: "member", resource: "plots", scope: "own", canRead: true, canAdd: true, canEdit: true, canDelete: true },
  { role: "member", resource: "plantings", scope: "own", canRead: true, canAdd: true, canEdit: true, canDelete: true },
];

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

function plot(lng: number, lat: number, width: number, height: number): [number, number][] {
  return [
    [lng, lat],
    [lng + width, lat + height * 0.06],
    [lng + width * 0.94, lat + height],
    [lng - width * 0.02, lat + height * 0.92],
    [lng, lat],
  ];
}

const originLng = 100.122;
const originLat = 14.5202;
const cellW = 0.00115;
const cellH = 0.00095;
const gap = 0.00022;

function at(column: number, row: number) {
  return plot(originLng + column * (cellW + gap), originLat + row * (cellH + gap), cellW, cellH);
}

export const GROUPS: SupplierGroup[] = [
  { id: "g1", name: "กลุ่มนาท่าพี่เลี้ยง", leaderId: "f1" },
  { id: "g2", name: "กลุ่มนารั้วใหญ่", leaderId: "f2" },
  { id: "g3", name: "กลุ่มนาทับตีเหล็ก", leaderId: "f3" },
  { id: "g4", name: "กลุ่มนาท่าระหัด", leaderId: "f4" },
  { id: "g5", name: "กลุ่มนาไผ่ขวาง", leaderId: "f5" },
  { id: "g6", name: "กลุ่มนาโคกโคเฒ่า", leaderId: "f6" },
  { id: "g7", name: "กลุ่มนาดอนตาล", leaderId: "f7" },
  { id: "g8", name: "กลุ่มนาดอนมะสังข์", leaderId: "f8" },
  { id: "g9", name: "กลุ่มนาพิหารแดง", leaderId: "f9" },
  { id: "g10", name: "กลุ่มนาดอนกำยาน", leaderId: "f10" },
  { id: "g11", name: "กลุ่มนาดอนโพธิ์ทอง", leaderId: "f11" },
  { id: "g12", name: "กลุ่มนาบ้านโพธิ์", leaderId: "f12" },
  { id: "g13", name: "กลุ่มนาสระแก้ว", leaderId: "f13" },
  { id: "g14", name: "กลุ่มนาตลิ่งชัน", leaderId: "f14" },
  { id: "g15", name: "กลุ่มนาบางกุ้ง", leaderId: "f15" },
  { id: "g16", name: "กลุ่มนาศาลาขาว", leaderId: "f16" },
  { id: "g17", name: "กลุ่มนาสวนแตง", leaderId: "f17" },
  { id: "g18", name: "กลุ่มนาสนามชัย", leaderId: "f18" },
  { id: "g19", name: "กลุ่มนาโพธิ์พระยา", leaderId: "f19" },
  { id: "g20", name: "กลุ่มนาสนามคลี", leaderId: "f20" },
  { id: "g21", name: "กลุ่มร่วมท่าพี่เลี้ยง", leaderId: "f21" },
];

export const FARMERS: Farmer[] = [
  { id: "f1", firstName: "สมชาย", lastName: "ใจดี", tel: "081-234-5678", address: "11 หมู่ 1", subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g1", deliveredKg: 51760 },
  { id: "f2", firstName: "สมหญิง", lastName: "ศรีนา", tel: "089-111-2233", address: "22 หมู่ 2", subdistrict: "รั้วใหญ่", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g2", deliveredKg: 28400 },
  { id: "f3", firstName: "ประสิทธิ์", lastName: "ทองดี", tel: "086-555-4433", address: "33 หมู่ 3", subdistrict: "ทับตีเหล็ก", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g3", deliveredKg: 41200 },
  { id: "f4", firstName: "มาลี", lastName: "เขียวขจี", tel: "082-333-4455", address: "44 หมู่ 4", subdistrict: "ท่าระหัด", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g4", deliveredKg: 15600 },
  { id: "f5", firstName: "แก้ว", lastName: "นวลจันทร์", tel: "089-777-6655", address: "55 หมู่ 5", subdistrict: "ไผ่ขวาง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g5", deliveredKg: 33800 },
  { id: "f6", firstName: "วิชัย", lastName: "บุญมี", tel: "081-100-1006", address: "66 หมู่ 6", subdistrict: "โคกโคเฒ่า", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g6", deliveredKg: 22100 },
  { id: "f7", firstName: "สุภาพ", lastName: "แสงทอง", tel: "081-100-1007", address: "77 หมู่ 7", subdistrict: "ดอนตาล", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g7", deliveredKg: 18450 },
  { id: "f8", firstName: "นภา", lastName: "ดวงดี", tel: "081-100-1008", address: "88 หมู่ 8", subdistrict: "ดอนมะสังข์", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g8", deliveredKg: 9600 },
  { id: "f9", firstName: "สมศักดิ์", lastName: "พูลผล", tel: "081-100-1009", address: "99 หมู่ 9", subdistrict: "พิหารแดง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g9", deliveredKg: 27300 },
  { id: "f10", firstName: "อรุณ", lastName: "ศรีสุข", tel: "081-100-1010", address: "10 หมู่ 1", subdistrict: "ดอนกำยาน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g10", deliveredKg: 14200 },
  { id: "f11", firstName: "ปราณี", lastName: "วงศ์ใหญ่", tel: "081-100-1011", address: "21 หมู่ 2", subdistrict: "ดอนโพธิ์ทอง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g11", deliveredKg: 30800 },
  { id: "f12", firstName: "ชัยวัฒน์", lastName: "นาดี", tel: "081-100-1012", address: "32 หมู่ 3", subdistrict: "บ้านโพธิ์", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g12", deliveredKg: 6750 },
  { id: "f13", firstName: "สมบูรณ์", lastName: "ทุ่งทอง", tel: "081-100-1013", address: "43 หมู่ 4", subdistrict: "สระแก้ว", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g13", deliveredKg: 45100 },
  { id: "f14", firstName: "วิไล", lastName: "เจริญผล", tel: "081-100-1014", address: "54 หมู่ 5", subdistrict: "ตลิ่งชัน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g14", deliveredKg: 19800 },
  { id: "f15", firstName: "ธนากร", lastName: "ศรีบุญ", tel: "081-100-1015", address: "65 หมู่ 6", subdistrict: "บางกุ้ง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g15", deliveredKg: 12400 },
  { id: "f16", firstName: "จิราภรณ์", lastName: "ทองคำ", tel: "081-100-1016", address: "76 หมู่ 7", subdistrict: "ศาลาขาว", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g16", deliveredKg: 23600 },
  { id: "f17", firstName: "สมปอง", lastName: "ไร่ทอง", tel: "081-100-1017", address: "87 หมู่ 8", subdistrict: "สวนแตง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g17", deliveredKg: 8900 },
  { id: "f18", firstName: "นิดา", lastName: "ผลดี", tel: "081-100-1018", address: "98 หมู่ 9", subdistrict: "สนามชัย", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g18", deliveredKg: 16750 },
  { id: "f19", firstName: "ประยูร", lastName: "สุขใจ", tel: "081-100-1019", address: "18 หมู่ 1", subdistrict: "โพธิ์พระยา", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g19", deliveredKg: 39200 },
  { id: "f20", firstName: "ลำดวน", lastName: "นาคินทร์", tel: "081-100-1020", address: "29 หมู่ 2", subdistrict: "สนามคลี", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g20", deliveredKg: 5400 },
  { id: "f21", firstName: "มานะ", lastName: "ตั้งตรง", tel: "081-100-1021", address: "40 หมู่ 3", subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g21", deliveredKg: 21300 },
];

export const PLOTS: Plot[] = [
  { id: "p1", farmerId: "f1", name: "นาสมชาย", areaRai: 12, subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 0) },
  { id: "p2", farmerId: "f2", name: "นาสมหญิง", areaRai: 10, subdistrict: "รั้วใหญ่", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 0) },
  { id: "p3", farmerId: "f3", name: "นาประสิทธิ์", areaRai: 18, subdistrict: "ทับตีเหล็ก", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(2, 0) },
  { id: "p4", farmerId: "f4", name: "นามาลี", areaRai: 8, subdistrict: "ท่าระหัด", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(3, 0) },
  { id: "p5", farmerId: "f5", name: "นาแก้ว", areaRai: 14, subdistrict: "ไผ่ขวาง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(4, 0) },
  { id: "p6", farmerId: "f6", name: "นาวิชัย", areaRai: 9, subdistrict: "โคกโคเฒ่า", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 1) },
  { id: "p7", farmerId: "f7", name: "นาสุภาพ", areaRai: 7, subdistrict: "ดอนตาล", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 1) },
  { id: "p8", farmerId: "f8", name: "นานภา", areaRai: 6, subdistrict: "ดอนมะสังข์", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(2, 1) },
  { id: "p9", farmerId: "f9", name: "นาสมศักดิ์", areaRai: 15, subdistrict: "พิหารแดง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(3, 1) },
  { id: "p10", farmerId: "f10", name: "นาอรุณ", areaRai: 11, subdistrict: "ดอนกำยาน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(4, 1) },
  { id: "p11", farmerId: "f11", name: "นาปราณี", areaRai: 13, subdistrict: "ดอนโพธิ์ทอง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 2) },
  { id: "p12", farmerId: "f12", name: "นาชัยวัฒน์", areaRai: 5, subdistrict: "บ้านโพธิ์", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 2) },
  { id: "p13", farmerId: "f13", name: "นาสมบูรณ์", areaRai: 16, subdistrict: "สระแก้ว", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(2, 2) },
  { id: "p14", farmerId: "f14", name: "นาวิไล", areaRai: 8, subdistrict: "ตลิ่งชัน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(3, 2) },
  { id: "p15", farmerId: "f15", name: "นาธนากร", areaRai: 4, subdistrict: "บางกุ้ง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(4, 2) },
  { id: "p16", farmerId: "f16", name: "นาจิราภรณ์", areaRai: 12, subdistrict: "ศาลาขาว", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 3) },
  { id: "p17", farmerId: "f17", name: "นาสมปอง", areaRai: 9, subdistrict: "สวนแตง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 3) },
  { id: "p18", farmerId: "f18", name: "นานิดา", areaRai: 7, subdistrict: "สนามชัย", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(2, 3) },
  { id: "p19", farmerId: "f19", name: "นาประยูร", areaRai: 17, subdistrict: "โพธิ์พระยา", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(3, 3) },
  { id: "p20", farmerId: "f20", name: "นาลำดวน", areaRai: 6, subdistrict: "สนามคลี", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(4, 3) },
  { id: "p21", farmerId: "f21", name: "นามานะ", areaRai: 10, subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 4) },
];

export const PLANTINGS: Planting[] = [];

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
