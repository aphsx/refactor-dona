export type Variety = "หอมมะลิ" | "ขาว" | "เหนียว";

export const VARIETIES: Variety[] = ["หอมมะลิ", "ขาว", "เหนียว"];

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
  variety: Variety;
  plantedOn: string;
  harvestOn: string;
  estKg: number;
  delivered: boolean;
};

export function farmerVarieties(plots: Plot[], plantings: Planting[], farmerId: string) {
  const ids = new Set(plots.filter((plot) => plot.farmerId === farmerId).map((plot) => plot.id));
  const names = [...new Set(plantings.filter((planting) => ids.has(planting.plotId)).map((planting) => planting.variety))];
  return names.length === 0 ? "—" : names.join(" · ");
}

export function farmerName(farmer: Farmer) {
  return `${farmer.firstName} ${farmer.lastName}`;
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
  { id: "g1", name: "กลุ่มนาแปลงรวมบ้านดอน", leaderId: "f1" },
  { id: "g2", name: "กลุ่มทุ่งนาโคกน้อย", leaderId: "f3" },
];

export const FARMERS: Farmer[] = [
  { id: "f1", firstName: "สมชาย", lastName: "ใจดี", tel: "081-234-5678", address: "123 หมู่ 3", subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g1", deliveredKg: 51760 },
  { id: "f2", firstName: "สมหญิง", lastName: "ศรีนา", tel: "089-111-2233", address: "45 หมู่ 3", subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g1", deliveredKg: 28400 },
  { id: "f3", firstName: "ประสิทธิ์", lastName: "ทองดี", tel: "086-555-4433", address: "78 หมู่ 7", subdistrict: "รั้วใหญ่", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g2", deliveredKg: 41200 },
  { id: "f4", firstName: "มาลี", lastName: "เขียวขจี", tel: "082-333-4455", address: "19 หมู่ 5", subdistrict: "ท่าระหัด", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: null, deliveredKg: 15600 },
  { id: "f5", firstName: "แก้ว", lastName: "นวลจันทร์", tel: "089-777-6655", address: "90 หมู่ 3", subdistrict: "ท่าพี่เลี้ยง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", groupId: "g1", deliveredKg: 33800 },
];

export const PLOTS: Plot[] = [
  { id: "p1", farmerId: "f1", name: "นาหน้าบ้าน", areaRai: 12, subdistrict: "บ้านดอน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 0) },
  { id: "p6", farmerId: "f1", name: "นาหลังบ้าน", areaRai: 6, subdistrict: "บ้านดอน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(2, 1) },
  { id: "p2", farmerId: "f2", name: "นาโคก", areaRai: 10, subdistrict: "บ้านดอน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 0) },
  { id: "p3", farmerId: "f3", name: "นาเขา", areaRai: 18, subdistrict: "โคกน้อย", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(2, 0) },
  { id: "p4", farmerId: "f4", name: "นาปลายทุ่ง", areaRai: 8, subdistrict: "ปลายทุ่ง", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 1) },
  { id: "p5", farmerId: "f5", name: "นาสวน", areaRai: 14, subdistrict: "บ้านดอน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 1) },
  { id: "p7", farmerId: "f1", name: "นาว่าง", areaRai: 4, subdistrict: "บ้านดอน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(0, 2) },
  { id: "p8", farmerId: "f2", name: "นาใหม่", areaRai: 5, subdistrict: "บ้านดอน", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(1, 2) },
  { id: "p9", farmerId: "f3", name: "นารอปลูก", areaRai: 9, subdistrict: "โคกน้อย", district: "เมืองสุพรรณบุรี", province: "สุพรรณบุรี", polygon: at(3, 0) },
];

export const PLANTINGS: Planting[] = [
  { id: "r1a", plotId: "p1", variety: "หอมมะลิ", plantedOn: "2025-11-10", harvestOn: "2026-03-01", estKg: 7600, delivered: true },
  { id: "r1", plotId: "p1", variety: "หอมมะลิ", plantedOn: "2026-06-15", harvestOn: "2026-10-04", estKg: 8400, delivered: false },
  { id: "r6", plotId: "p6", variety: "เหนียว", plantedOn: "2026-07-02", harvestOn: "2026-10-22", estKg: 3900, delivered: false },
  { id: "r2", plotId: "p2", variety: "หอมมะลิ", plantedOn: "2026-06-18", harvestOn: "2026-10-06", estKg: 6500, delivered: false },
  { id: "r3", plotId: "p3", variety: "ขาว", plantedOn: "2026-06-25", harvestOn: "2026-10-15", estKg: 12000, delivered: false },
  { id: "r4", plotId: "p4", variety: "เหนียว", plantedOn: "2026-07-10", harvestOn: "2026-11-02", estKg: 5000, delivered: false },
  { id: "r5", plotId: "p5", variety: "หอมมะลิ", plantedOn: "2026-05-20", harvestOn: "2026-09-18", estKg: 9100, delivered: true },
];

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
