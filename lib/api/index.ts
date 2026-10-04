import { apiListAll, apiRequest, getApiToken, ApiError } from "@/lib/api/client";
import {
  VARIETIES,
  asMillProductKind,
  asMillReceiptDirection,
  closeRing,
  isClosedRing,
  openRing,
  polygonAreaRai,
  type Farmer,
  type FarmerInput,
  type MillProductKind,
  type MillReceipt,
  type MillReceiptDirection,
  type MillSnapshot,
  type Permission,
  type PermissionFlag,
  type PermissionResource,
  type PermissionRole,
  type Planting,
  type Plot,
  type PlotActivity,
  type PlotActivityPayload,
  type PlotActivityType,
  type RoleGrant,
  type SupplierGroup,
  type Variety,
} from "@/lib/mill";

export {
  ApiError,
  apiLogin,
  apiMessage,
  clearAuthSession,
  getApiActor,
  getAuthSession,
  restoreAuthSession,
  setApiActor,
  setAuthSession,
  type AuthSession,
} from "@/lib/api/client";

type WirePermission = {
  roleId: number;
  resource: string;
  scope: string;
  canRead: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type WirePerson = Farmer & { role: string; scope: string };

type WirePlot = Omit<Plot, "polygon"> & { polygon: number[][] };

type WirePlanting = Omit<Planting, "varietyId"> & { varietyId: number };

type WirePlotActivity = Omit<PlotActivity, "type" | "payload"> & {
  type: string;
  payload: PlotActivityPayload | Record<string, unknown>;
};

const ROLE_ID: Record<PermissionRole, number> = { mill: 1, leader: 2, member: 3 };
const ROLE_CODE: Record<number, PermissionRole> = { 1: "mill", 2: "leader", 3: "member" };
const FLAG_KEY: Record<PermissionFlag, keyof Pick<WirePermission, "canRead" | "canAdd" | "canEdit" | "canDelete">> = {
  canRead: "canRead",
  canAdd: "canAdd",
  canEdit: "canEdit",
  canDelete: "canDelete",
};

function asPolygon(points: number[][] | null | undefined): [number, number][] {
  if (!points?.length) return [];
  return points.map((point) => [Number(point[0]), Number(point[1])] as [number, number]);
}

function asVariety(id: number): Variety {
  if (VARIETIES.some((item) => item.id === id)) return id as Variety;
  return 1;
}

function asPermission(item: WirePermission): Permission {
  return {
    role: ROLE_CODE[item.roleId] ?? "member",
    resource: item.resource as PermissionResource,
    scope: item.scope as Permission["scope"],
    canRead: item.canRead,
    canAdd: item.canAdd,
    canEdit: item.canEdit,
    canDelete: item.canDelete,
  };
}

function asPlot(item: WirePlot): Plot {
  return { ...item, polygon: asPolygon(item.polygon) };
}

function asPlanting(item: WirePlanting): Planting {
  return { ...item, varietyId: asVariety(item.varietyId) };
}

function asPlotActivity(item: WirePlotActivity): PlotActivity {
  return {
    ...item,
    type: item.type as PlotActivityType,
    payload: (item.payload ?? {}) as PlotActivityPayload,
    note: item.note ?? "",
  };
}

function millGrants(people: WirePerson[]): RoleGrant[] {
  return people.filter((person) => person.role === "mill").map((person) => ({ farmerId: person.id, role: "mill" as const }));
}

export async function loadMillSnapshot(): Promise<MillSnapshot> {
  const [groups, farmers, plots, plantings, activities, receipts, permissions, people] = await Promise.all([
    apiListAll<SupplierGroup>("/groups"),
    apiListAll<Farmer>("/farmers"),
    apiListAll<WirePlot>("/plots"),
    apiListAll<WirePlanting>("/plantings"),
    apiListAll<WirePlotActivity>("/plot-activities"),
    apiListAll<MillReceipt>("/mill-receipts"),
    apiRequest<{ items: WirePermission[] }>("/permissions").then((data) => data.items ?? []),
    apiListAll<WirePerson>("/people"),
  ]);

  return {
    groups,
    farmers,
    plots: plots.map(asPlot),
    plantings: plantings.map(asPlanting),
    activities: activities.map(asPlotActivity),
    receipts: receipts.map((item) => ({
      ...item,
      varietyId: asVariety(Number(item.varietyId)),
      productKind: asMillProductKind(item.productKind),
      direction: asMillReceiptDirection(item.direction),
    })),
    permissions: permissions.map(asPermission),
    roleGrants: millGrants(people),
  };
}

export const api = {
  createGroup: (name: string, leaderId: string) =>
    apiRequest<SupplierGroup>("/groups", { method: "POST", body: JSON.stringify({ name, leaderId }) }),

  updateGroup: (id: string, name: string, leaderId: string) =>
    apiRequest<SupplierGroup>(`/groups/${id}`, { method: "PUT", body: JSON.stringify({ name, leaderId }) }),

  createFarmer: (input: FarmerInput) => apiRequest<Farmer>("/farmers", { method: "POST", body: JSON.stringify(input) }),

  updateFarmer: (id: string, input: FarmerInput) => apiRequest<Farmer>(`/farmers/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  assignFarmerGroup: (id: string, groupId: string | null) =>
    apiRequest<Farmer>(`/farmers/${id}/group`, { method: "PATCH", body: JSON.stringify({ groupId }) }),

  createPlot: (input: {
    farmerId: string;
    name: string;
    areaRai: number;
    provinceId: number;
    districtId: number;
    subdistrictId: number;
    polygon?: [number, number][];
    varietyId?: Variety;
    plantedOn?: string;
    harvestOn?: string;
    estKg?: number;
  }) => apiRequest<WirePlot>("/plots", { method: "POST", body: JSON.stringify(input) }).then(asPlot),

  updatePlot: (id: string, input: { name: string; areaRai: number; provinceId: number; districtId: number; subdistrictId: number }) =>
    apiRequest<WirePlot>(`/plots/${id}`, { method: "PUT", body: JSON.stringify(input) }).then(asPlot),

  saveBoundary: (id: string, polygon: [number, number][], areaRai: number) =>
    apiRequest<WirePlot>(`/plots/${id}/boundary`, { method: "PUT", body: JSON.stringify({ polygon, areaRai }) }).then(asPlot),

  uploadPlotPreview: async (plotId: string, file: Blob) => {
    const token = getApiToken();
    if (!token) throw new ApiError("ต้องเข้าสู่ระบบก่อน", 401);
    const form = new FormData();
    form.append("plotId", plotId);
    form.append("file", file, "preview.webp");
    let response: Response;
    try {
      response = await fetch("/api/plot-preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    } catch {
      throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", 0);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        typeof body?.error === "string" ? body.error : "อัปโหลดรูปแปลงไม่สำเร็จ",
        response.status,
      );
    }
    return asPlot(body as WirePlot);
  },

  measureArea: (polygon: [number, number][]) =>
    apiRequest<{ areaRai: number; areaSqm: number }>("/plots/measure-area", {
      method: "POST",
      body: JSON.stringify({ polygon }),
    }),

  deletePlot: (id: string) => apiRequest<void>(`/plots/${id}`, { method: "DELETE" }),

  createPlanting: (input: { plotId: string; varietyId: Variety; plantedOn: string; harvestOn: string; estKg: number }) =>
    apiRequest<WirePlanting>("/plantings", { method: "POST", body: JSON.stringify(input) }).then(asPlanting),

  updatePlanting: (id: string, input: { varietyId: Variety; plantedOn: string; harvestOn: string; estKg: number }) =>
    apiRequest<WirePlanting>(`/plantings/${id}`, { method: "PUT", body: JSON.stringify(input) }).then(asPlanting),

  deletePlanting: (id: string) => apiRequest<void>(`/plantings/${id}`, { method: "DELETE" }),

  createMillReceipt: (input: {
    farmerId: string;
    varietyId: Variety;
    productKind: MillProductKind;
    direction: MillReceiptDirection;
    kg: number;
    receivedOn: string;
  }) => apiRequest<MillReceipt>("/mill-receipts", { method: "POST", body: JSON.stringify(input) }),

  updateMillReceipt: (id: string, input: {
    varietyId: Variety;
    productKind: MillProductKind;
    direction: MillReceiptDirection;
    kg: number;
    receivedOn: string;
  }) => apiRequest<MillReceipt>(`/mill-receipts/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  deleteMillReceipt: (id: string) => apiRequest<void>(`/mill-receipts/${id}`, { method: "DELETE" }),

  createPlotActivity: (input: {
    plantingId: string;
    type: PlotActivityType;
    occurredOn: string;
    payload: PlotActivityPayload;
    note?: string;
  }) => apiRequest<WirePlotActivity>("/plot-activities", { method: "POST", body: JSON.stringify(input) }).then(asPlotActivity),

  updatePlotActivity: (
    id: string,
    input: { type: PlotActivityType; occurredOn: string; payload: PlotActivityPayload; note?: string },
  ) => apiRequest<WirePlotActivity>(`/plot-activities/${id}`, { method: "PUT", body: JSON.stringify(input) }).then(asPlotActivity),

  deletePlotActivity: (id: string) => apiRequest<void>(`/plot-activities/${id}`, { method: "DELETE" }),

  setPermission: (role: PermissionRole, resource: PermissionResource, flag: PermissionFlag, on: boolean) =>
    apiRequest<WirePermission>(`/permissions/${ROLE_ID[role]}/${resource}`, {
      method: "PATCH",
      body: JSON.stringify({ [FLAG_KEY[flag]]: on }),
    }).then(asPermission),

  assignRole: (farmerId: string, role: PermissionRole) =>
    apiRequest<WirePerson>(`/people/${farmerId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),

  revokeRole: (farmerId: string) => apiRequest<void>(`/people/${farmerId}/role`, { method: "DELETE" }),
};

/** PostGIS geography (WGS84 spheroid). Falls back to local estimate if API fails. */
export async function measureRingAreaRai(points: [number, number][]) {
  const ring = isClosedRing(points) ? points : closeRing(openRing(points));
  if (!ring) return null;
  try {
    const { areaRai } = await api.measureArea(ring);
    return areaRai;
  } catch {
    return polygonAreaRai(ring);
  }
}
