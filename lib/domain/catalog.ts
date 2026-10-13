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
