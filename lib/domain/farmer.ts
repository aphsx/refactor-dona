export type Farmer = {
  id: string;
  prefixId: number | null;
  prefixName?: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  dateOfBirth: string;
  farmerNumber?: string;
  /** Legacy; omitted on create/update. */
  tel?: string;
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

export type FarmerInput = {
  prefixId: number;
  firstName: string;
  lastName: string;
  nationalId: string;
  dateOfBirth: string;
  farmerNumber?: string;
  address: string;
  provinceId: number;
  districtId: number;
  subdistrictId: number;
  groupId: string | null;
};

export function farmerName(farmer: Pick<Farmer, "firstName" | "lastName" | "prefixName">) {
  const base = `${farmer.firstName} ${farmer.lastName}`.trim();
  const prefix = farmer.prefixName?.trim();
  return prefix ? `${prefix}${base}` : base;
}

/** Normalize to 13 digits, or null if invalid. */
export function canonicalNationalId(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  return digits;
}

/** Display form X-XXXX-XXXXX-XX-X, or null if invalid. */
export function formatNationalId(value: string) {
  const digits = canonicalNationalId(value);
  if (!digits) return null;
  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

export function farmerHandle(farmer: Farmer) {
  const id = formatNationalId(farmer.nationalId) ?? farmer.nationalId;
  return `${farmerName(farmer)} · ${id}`;
}

const FARMER_COLORS = ["#5098BA", "#005983", "#024F7B", "#22759C", "#18B473", "#6B8F9E"];

export function farmerColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return FARMER_COLORS[hash % FARMER_COLORS.length];
}
