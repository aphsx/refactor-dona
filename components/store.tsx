"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ApiError, api, apiMessage, loadMillSnapshot, setApiActor } from "@/lib/api";
import type {
  FarmerInput,
  MillSnapshot,
  PermissionFlag,
  PermissionResource,
  PermissionRole,
  Variety,
} from "@/lib/mill";

type Store = MillSnapshot & {
  ready: boolean;
  loadError: string;
  actingRole: PermissionRole;
  reload: () => Promise<void>;
  createGroup: (name: string, leaderId: string) => Promise<string | null>;
  updateGroup: (groupId: string, name: string, leaderId: string) => Promise<string | null>;
  createFarmer: (input: FarmerInput) => Promise<string | null>;
  updateFarmer: (farmerId: string, input: FarmerInput) => Promise<string | null>;
  assignFarmer: (farmerId: string, groupId: string | null) => Promise<string | null>;
  addPlot: (
    farmerId: string,
    input: {
      name: string;
      areaRai: number;
      varietyId: Variety;
      plantedOn: string;
      harvestOn: string;
      estKg: number;
      provinceId: number;
      districtId: number;
      subdistrictId: number;
      polygon: [number, number][];
    },
  ) => Promise<string | null>;
  savePlot: (plotId: string, input: { name: string; areaRai: number; provinceId?: number; districtId?: number; subdistrictId?: number }) => Promise<string | null>;
  saveBoundary: (plotId: string, polygon: [number, number][], areaRai: number) => Promise<string | null>;
  removePlot: (plotId: string) => Promise<string | null>;
  savePlanting: (
    plotId: string,
    input: { plantingId: string | null; varietyId: Variety; plantedOn: string; harvestOn: string; estKg: number },
  ) => Promise<string | null>;
  removePlanting: (plantingId: string) => Promise<string | null>;
  setPermission: (role: PermissionRole, resource: PermissionResource, flag: PermissionFlag, on: boolean) => Promise<string | null>;
  assignRole: (farmerId: string, role: PermissionRole) => Promise<string | null>;
  revokeRole: (farmerId: string) => Promise<string | null>;
};

const empty: MillSnapshot = {
  farmers: [],
  groups: [],
  plots: [],
  plantings: [],
  permissions: [],
  roleGrants: [],
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MillSnapshot>(empty);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actingRole] = useState<PermissionRole>("mill");
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    setApiActor({ role: actingRole });
  }, [actingRole]);

  async function reload() {
    try {
      const next = await loadMillSnapshot();
      dataRef.current = next;
      setData(next);
      setLoadError("");
    } catch (error) {
      setLoadError(apiMessage(error));
      throw error;
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await reload();
      } catch (error) {
        if (!alive) return;
        setLoadError(apiMessage(error));
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function mutate(run: () => Promise<unknown>) {
    try {
      await run();
      await reload();
      return null;
    } catch (error) {
      return apiMessage(error);
    }
  }

  const store: Store = {
    ...data,
    ready,
    loadError,
    actingRole,
    reload,
    createGroup: (name, leaderId) => mutate(() => api.createGroup(name.trim(), leaderId)),
    updateGroup: (groupId, name, leaderId) => mutate(() => api.updateGroup(groupId, name.trim(), leaderId)),
    createFarmer: (input) =>
      mutate(() =>
        api.createFarmer({
          ...input,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          address: input.address.trim(),
        }),
      ),
    updateFarmer: (farmerId, input) =>
      mutate(() =>
        api.updateFarmer(farmerId, {
          ...input,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          address: input.address.trim(),
        }),
      ),
    assignFarmer: (farmerId, groupId) => mutate(() => api.assignFarmerGroup(farmerId, groupId)),
    addPlot: (farmerId, input) =>
      mutate(() => {
        const body = {
          farmerId,
          name: input.name.trim(),
          areaRai: input.areaRai,
          provinceId: input.provinceId,
          districtId: input.districtId,
          subdistrictId: input.subdistrictId,
          polygon: input.polygon,
          ...(input.plantedOn || input.harvestOn
            ? {
                varietyId: input.varietyId,
                plantedOn: input.plantedOn,
                harvestOn: input.harvestOn,
                estKg: input.estKg,
              }
            : {}),
        };
        return api.createPlot(body);
      }),
    savePlot: (plotId, input) =>
      mutate(async () => {
        const current = dataRef.current.plots.find((item) => item.id === plotId);
        if (!current) throw new ApiError("ไม่พบแปลง", 404);
        return api.updatePlot(plotId, {
          name: input.name.trim(),
          areaRai: input.areaRai,
          provinceId: input.provinceId ?? current.provinceId,
          districtId: input.districtId ?? current.districtId,
          subdistrictId: input.subdistrictId ?? current.subdistrictId,
        });
      }),
    saveBoundary: (plotId, polygon, areaRai) => mutate(() => api.saveBoundary(plotId, polygon, areaRai)),
    removePlot: (plotId) => mutate(() => api.deletePlot(plotId)),
    savePlanting: (plotId, input) =>
      mutate(() => {
        const body = {
          varietyId: input.varietyId,
          plantedOn: input.plantedOn,
          harvestOn: input.harvestOn,
          estKg: input.estKg,
        };
        return input.plantingId ? api.updatePlanting(input.plantingId, body) : api.createPlanting({ plotId, ...body });
      }),
    removePlanting: (plantingId) => mutate(() => api.deletePlanting(plantingId)),
    setPermission: (role, resource, flag, on) => mutate(() => api.setPermission(role, resource, flag, on)),
    assignRole: (farmerId, role) => mutate(() => api.assignRole(farmerId, role)),
    revokeRole: (farmerId) => mutate(() => api.revokeRole(farmerId)),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useMill() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useMill must be used inside StoreProvider");
  return store;
}
