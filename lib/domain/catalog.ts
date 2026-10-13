/** Variety id from API (`varieties.id`). */
export type Variety = number;

export type VarietyItem = {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

/** varieties.id from seed (2xx). Seed defaults until snapshot loads. */
export const VARIETY_HOMMALI_ID = 201; // หอมมะลิ
export const VARIETY_KHAO_ID = 202; // ขาว
export const VARIETY_STICKY_ID = 203; // เหนียว

export let VARIETIES: VarietyItem[] = [
  { id: VARIETY_HOMMALI_ID, name: "หอมมะลิ" },
  { id: VARIETY_KHAO_ID, name: "ขาว" },
  { id: VARIETY_STICKY_ID, name: "เหนียว" },
];

export function syncVarieties(items: VarietyItem[]) {
  if (items.length > 0) VARIETIES = items;
}

export function varietyName(id: number) {
  return VARIETIES.find((item) => item.id === id)?.name ?? "—";
}

export function defaultVarietyId(varieties: VarietyItem[] = VARIETIES) {
  return varieties[0]?.id ?? VARIETY_HOMMALI_ID;
}

/** Name prefix id from API (`name_prefixes.id`). */
export type NamePrefix = number;

export type NamePrefixItem = {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

/** name_prefixes.id from seed (6xx). Seed defaults until snapshot loads. */
export const NAME_PREFIX_NAI_ID = 601; // นาย
export const NAME_PREFIX_NANG_ID = 602; // นาง
export const NAME_PREFIX_NANGSAO_ID = 603; // นางสาว
export const NAME_PREFIX_DEKCHAI_ID = 604; // เด็กชาย
export const NAME_PREFIX_DEKYING_ID = 605; // เด็กหญิง

export let NAME_PREFIXES: NamePrefixItem[] = [
  { id: NAME_PREFIX_NAI_ID, name: "นาย" },
  { id: NAME_PREFIX_NANG_ID, name: "นาง" },
  { id: NAME_PREFIX_NANGSAO_ID, name: "นางสาว" },
  { id: NAME_PREFIX_DEKCHAI_ID, name: "เด็กชาย" },
  { id: NAME_PREFIX_DEKYING_ID, name: "เด็กหญิง" },
];

export function syncNamePrefixes(items: NamePrefixItem[]) {
  if (items.length > 0) NAME_PREFIXES = items;
}

export function namePrefixName(id: number) {
  return NAME_PREFIXES.find((item) => item.id === id)?.name ?? "—";
}

export function defaultNamePrefixId(prefixes: NamePrefixItem[] = NAME_PREFIXES) {
  return prefixes[0]?.id ?? NAME_PREFIX_NAI_ID;
}
