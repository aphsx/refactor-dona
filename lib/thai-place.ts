import places from "../node_modules/thai-address-select/dist/src/data/thai-address.json";

export type PlaceIds = {
  provinceId: number;
  districtId: number;
  subdistrictId: number;
};

type ThaiSubdistrict = {
  id: number;
  name_th: string;
  lat: number | null;
  long: number | null;
};
type ThaiDistrict = {
  id: number;
  name_th: string;
  sub_districts?: ThaiSubdistrict[];
};
type ThaiProvince = {
  id: number;
  name_th: string;
  districts?: ThaiDistrict[];
};

const thaiPlaces = places as ThaiProvince[];

const provinceById = new Map(thaiPlaces.map((item) => [item.id, item]));
const districtById = new Map<number, ThaiDistrict & { provinceId: number }>();
const subdistrictById = new Map<number, ThaiSubdistrict & { provinceId: number; districtId: number }>();

for (const province of thaiPlaces) {
  for (const district of province.districts ?? []) {
    districtById.set(district.id, { ...district, provinceId: province.id });
    for (const subdistrict of district.sub_districts ?? []) {
      subdistrictById.set(subdistrict.id, {
        ...subdistrict,
        provinceId: province.id,
        districtId: district.id,
      });
    }
  }
}

export function provinceOptions() {
  return thaiPlaces
    .slice()
    .sort((a, b) => a.name_th.localeCompare(b.name_th, "th"))
    .map((item) => ({ value: String(item.id), label: item.name_th }));
}

export function districtOptions(provinceId: number) {
  const province = provinceById.get(provinceId);
  if (!province) return [];
  return (province.districts ?? [])
    .slice()
    .sort((a, b) => a.name_th.localeCompare(b.name_th, "th"))
    .map((item) => ({ value: String(item.id), label: item.name_th }));
}

export function subdistrictOptions(provinceId: number, districtId: number) {
  const district = districtById.get(districtId);
  if (!district || district.provinceId !== provinceId) return [];
  return (district.sub_districts ?? [])
    .slice()
    .sort((a, b) => a.name_th.localeCompare(b.name_th, "th"))
    .map((item) => ({ value: String(item.id), label: item.name_th }));
}

export function provinceName(id: number) {
  return provinceById.get(id)?.name_th ?? "—";
}

export function districtName(id: number) {
  return districtById.get(id)?.name_th ?? "—";
}

export function subdistrictName(id: number) {
  return subdistrictById.get(id)?.name_th ?? "—";
}

export function placeLabel(place: PlaceIds | null | undefined) {
  if (!place?.provinceId || !place.districtId || !place.subdistrictId) return "—";
  return `${subdistrictName(place.subdistrictId)} ${districtName(place.districtId)} ${provinceName(place.provinceId)}`;
}

export function placeParts(place: PlaceIds | null | undefined) {
  if (!place?.provinceId || !place.districtId || !place.subdistrictId) {
    return { province: "", district: "", subdistrict: "" };
  }
  return {
    province: provinceName(place.provinceId),
    district: districtName(place.districtId),
    subdistrict: subdistrictName(place.subdistrictId),
  };
}

export function isCompletePlace(place: PlaceIds | null | undefined) {
  if (!place) return false;
  const sub = subdistrictById.get(place.subdistrictId);
  return !!sub && sub.provinceId === place.provinceId && sub.districtId === place.districtId;
}

export function placeAt(lng: number, lat: number): PlaceIds | null {
  let best: PlaceIds | null = null;
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
        best = {
          provinceId: province.id,
          districtId: district.id,
          subdistrictId: subdistrict.id,
        };
      }
    }
  }
  return best;
}

export type PlaceCenter = { lng: number; lat: number; zoom: number };

function averagePoint(points: { lat: number; long: number }[]): { lng: number; lat: number } | null {
  if (points.length === 0) return null;
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.long, 0) / points.length;
  return { lng, lat };
}

/** Best map focus for a Thai place selection (tambon → amphoe → province). */
export function placeCenter(place: Partial<PlaceIds> | null | undefined): PlaceCenter | null {
  if (!place) return null;

  if (place.subdistrictId) {
    const sub = subdistrictById.get(place.subdistrictId);
    if (sub?.lat != null && sub.long != null) {
      return { lng: sub.long, lat: sub.lat, zoom: 15 };
    }
  }

  if (place.districtId) {
    const district = districtById.get(place.districtId);
    const points = (district?.sub_districts ?? []).filter(
      (item): item is ThaiSubdistrict & { lat: number; long: number } => item.lat != null && item.long != null,
    );
    const avg = averagePoint(points);
    if (avg) return { ...avg, zoom: 12 };
  }

  if (place.provinceId) {
    const province = provinceById.get(place.provinceId);
    const points = (province?.districts ?? []).flatMap((district) =>
      (district.sub_districts ?? []).filter(
        (item): item is ThaiSubdistrict & { lat: number; long: number } => item.lat != null && item.long != null,
      ),
    );
    const avg = averagePoint(points);
    if (avg) return { ...avg, zoom: 9 };
  }

  return null;
}
