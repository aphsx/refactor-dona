export type Farmer = {
  id: string;
  prefixId: number | null;
  prefixName?: string;
  firstName: string;
  lastName: string;
  /** DB generated: firstName + lastName (no prefix). */
  fullName?: string;
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

/** Full display name with prefix (รายละเอียด / หัวข้อ). */
export function farmerName(farmer: Pick<Farmer, "firstName" | "lastName" | "prefixName" | "fullName">) {
  const base = farmerFullName(farmer);
  const prefix = farmer.prefixName?.trim();
  return prefix ? `${prefix}${base}` : base;
}

/** Prefer DB fullName; fallback to first + last. */
export function farmerFullName(farmer: Pick<Farmer, "firstName" | "lastName"> & { fullName?: string }) {
  const stored = farmer.fullName?.trim();
  if (stored) return stored;
  return `${farmer.firstName} ${farmer.lastName}`.trim();
}

/** Normalize to 13 digits, or null if invalid. */
export function canonicalNationalId(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  return digits;
}

/** Client-side required checks aligned with API FarmerInput. */
export function validateFarmerInput(input: FarmerInput): string | null {
  if (!input.prefixId || input.prefixId <= 0) return "เลือกคำนำหน้า";
  if (!input.firstName.trim()) return "กรอกชื่อ";
  if (!input.lastName.trim()) return "กรอกนามสกุล";
  if (!canonicalNationalId(input.nationalId)) return "เลขบัตรประชาชนต้องมี 13 หลัก";
  if (!input.dateOfBirth.trim()) return "กรอกวันเดือนปีเกิด";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth.trim())) return "วันเดือนปีเกิดไม่ถูกต้อง";
  if (!input.address.trim()) return "กรอกที่อยู่";
  if (input.provinceId <= 0 || input.districtId <= 0 || input.subdistrictId <= 0) {
    return "เลือกตำบล อำเภอ และจังหวัด";
  }
  return null;
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
