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
  groupName?: string;
  plotCount?: number;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FarmerPage = {
  items: Farmer[];
  total: number;
};

export type FarmerInput = Omit<Farmer, "id" | "createdAt" | "updatedAt" | "groupName" | "plotCount">;

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

const FARMER_COLORS = ["#5098BA", "#005983", "#024F7B", "#22759C", "#18B473", "#6B8F9E"];

export function farmerColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return FARMER_COLORS[hash % FARMER_COLORS.length];
}
