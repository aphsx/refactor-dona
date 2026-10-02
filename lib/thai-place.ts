import { getDistricts, getProvinces, getSubDistricts } from "thai-address-select/utils";

export function provinceNames() {
  return getProvinces();
}

export function districtNames(province: string) {
  return province ? getDistricts(province) : [];
}

export function subdistrictNames(province: string, district: string) {
  return province && district ? getSubDistricts(province, district) : [];
}
