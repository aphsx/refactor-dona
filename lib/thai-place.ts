import { getDistricts, getProvinces, getSubDistricts } from "thai-address-select/utils";
import places from "../node_modules/thai-address-select/dist/src/data/thai-address.json";

type ThaiSubdistrict = { name_th: string; lat: number | null; long: number | null };
type ThaiDistrict = { name_th: string; sub_districts?: ThaiSubdistrict[] };
type ThaiProvince = { name_th: string; districts?: ThaiDistrict[] };

const thaiPlaces = places as ThaiProvince[];

export function provinceNames() {
  return getProvinces();
}

export function districtNames(province: string) {
  return province ? getDistricts(province) : [];
}

export function subdistrictNames(province: string, district: string) {
  return province && district ? getSubDistricts(province, district) : [];
}

export function placeAt(lng: number, lat: number) {
  let best: { province: string; district: string; subdistrict: string } | null = null;
  let bestDistance = Infinity;
  for (const province of thaiPlaces) {
    for (const district of province.districts ?? []) {
      for (const subdistrict of district.sub_districts ?? []) {
        if (subdistrict.lat == null || subdistrict.long == null) continue;
        const dLat = subdistrict.lat - lat;
        const dLng = subdistrict.long - lng;
        const distance = dLat * dLat + dLng * dLng;
        if (distance >= bestDistance) continue;
        bestDistance = distance;
        best = { province: province.name_th, district: district.name_th, subdistrict: subdistrict.name_th };
      }
    }
  }
  return best;
}
