import { apiListAll, apiRequest } from "@/lib/api/client";
import {
  VARIETIES,
  type Farmer,
  type FarmerInput,
  type MillSnapshot,
  type Permission,
  type PermissionFlag,
  type PermissionResource,
  type PermissionRole,
  type Planting,
  type Plot,
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

function millGrants(people: WirePerson[]): RoleGrant[] {
  return people.filter((person) => person.role === "mill").map((person) => ({ farmerId: person.id, role: "mill" as const }));
}

export async function loadMillSnapshot(): Promise<MillSnapshot> {
  const [groups, farmers, plots, plantings, permissions, people] = await Promise.all([
    apiListAll<SupplierGroup>("/groups"),
    apiListAll<Farmer>("/farmers"),
    apiListAll<WirePlot>("/plots"),
    apiListAll<WirePlanting>("/plantings"),
    apiRequest<{ items: WirePermission[] }>("/permissions").then((data) => data.items ?? []),
    apiListAll<WirePerson>("/people"),
  ]);

  return {
    groups,
    farmers,
    plots: plots.map(asPlot),
    plantings: plantings.map(asPlanting),
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

  deletePlot: (id: string) => apiRequest<void>(`/plots/${id}`, { method: "DELETE" }),

  createPlanting: (input: { plotId: string; varietyId: Variety; plantedOn: string; harvestOn: string; estKg: number }) =>
    apiRequest<WirePlanting>("/plantings", { method: "POST", body: JSON.stringify(input) }).then(asPlanting),

  updatePlanting: (id: string, input: { varietyId: Variety; plantedOn: string; harvestOn: string; estKg: number }) =>
    apiRequest<WirePlanting>(`/plantings/${id}`, { method: "PUT", body: JSON.stringify(input) }).then(asPlanting),

  deletePlanting: (id: string) => apiRequest<void>(`/plantings/${id}`, { method: "DELETE" }),

  setPermission: (role: PermissionRole, resource: PermissionResource, flag: PermissionFlag, on: boolean) =>
    apiRequest<WirePermission>(`/permissions/${ROLE_ID[role]}/${resource}`, {
      method: "PATCH",
      body: JSON.stringify({ [FLAG_KEY[flag]]: on }),
    }).then(asPermission),

  assignRole: (farmerId: string, role: PermissionRole) =>
    apiRequest<WirePerson>(`/people/${farmerId}/role`, { method: "PUT", body: JSON.stringify({ role }) }),

  revokeRole: (farmerId: string) => apiRequest<void>(`/people/${farmerId}/role`, { method: "DELETE" }),
};
