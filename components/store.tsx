"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, apiMessage, loadOrgSnapshot, setApiActor } from "@/lib/api";
import {
  canonicalNationalId,
  type FarmerInput,
  type OrgSnapshot,
  type PermissionFlag,
  type PermissionResource,
  type PermissionRole,
  type Plot,
  type PlotActivityPayload,
  type PlotActivityType,
  type Variety,
} from "@/lib/domain";

type Store = OrgSnapshot & {
  ready: boolean;
  loadError: string;
  revision: number;
  actingRole: PermissionRole;
  reload: () => Promise<void>;
  createGroup: (name: string, leaderId: string) => Promise<string | null>;
  updateGroup: (groupId: string, name: string, leaderId: string) => Promise<string | null>;
  createVariety: (name: string) => Promise<string | null>;
  updateVariety: (varietyId: number, name: string) => Promise<string | null>;
  removeVariety: (varietyId: number) => Promise<string | null>;
  createNamePrefix: (name: string) => Promise<string | null>;
  updateNamePrefix: (prefixId: number, name: string) => Promise<string | null>;
  removeNamePrefix: (prefixId: number) => Promise<string | null>;
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
      preview?: Blob | null;
    },
  ) => Promise<string | null>;
  savePlot: (plotId: string, input: { name: string; areaRai: number; provinceId?: number; districtId?: number; subdistrictId?: number }) => Promise<string | null>;
  saveBoundary: (plotId: string, polygon: [number, number][], areaRai: number, preview?: Blob | null) => Promise<string | null>;
  removePlot: (plotId: string) => Promise<string | null>;
  savePlanting: (
    plotId: string,
    input: { plantingId: string | null; varietyId: Variety; plantedOn: string; harvestOn: string; estKg: number },
  ) => Promise<{ error: string | null; plantingId: string | null }>;
  removePlanting: (plantingId: string) => Promise<string | null>;
  saveActivity: (input: {
    id?: string | null;
    plantingId: string;
    type: PlotActivityType;
    occurredOn: string;
    payload: PlotActivityPayload;
    note?: string;
  }) => Promise<string | null>;
  removeActivity: (activityId: string) => Promise<string | null>;
  setPermission: (role: PermissionRole, resource: PermissionResource, flag: PermissionFlag, on: boolean) => Promise<string | null>;
  assignRole: (farmerId: string, role: PermissionRole) => Promise<string | null>;
  revokeRole: (farmerId: string) => Promise<string | null>;
};

const empty: OrgSnapshot = {
  farmers: [],
  farmerPage: { items: [], total: 0 },
  groups: [],
  plots: [],
  plotPage: { items: [], total: 0 },
  plantings: [],
  activities: [],
  varieties: [],
  namePrefixes: [],
  permissions: [],
  roleGrants: [],
};

function asFarmerInput(input: FarmerInput): FarmerInput {
  return {
    ...input,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationalId: canonicalNationalId(input.nationalId) ?? input.nationalId.trim(),
    dateOfBirth: input.dateOfBirth.trim(),
    farmerNumber: input.farmerNumber?.trim() || undefined,
    address: input.address.trim(),
  };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OrgSnapshot>(empty);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [actingRole] = useState<PermissionRole>("org");
  const dataRef = useRef(data);
  dataRef.current = data;
  /** Blocks duplicate createPlot from rapid confirm clicks (same farmer/name/area/ring). */
  const createPlotInflight = useRef(new Set<string>());

  useEffect(() => {
    setApiActor({ role: actingRole });
  }, [actingRole]);

  async function reload() {
    try {
      const next = await loadOrgSnapshot();
      dataRef.current = next;
      setData(next);
      setRevision((value) => value + 1);
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

  function patchPlots(updater: (plots: Plot[]) => Plot[]) {
    setData((prev) => {
      const next = { ...prev, plots: updater(prev.plots) };
      dataRef.current = next;
      return next;
    });
  }

  const store: Store = {
    ...data,
    ready,
    loadError,
    revision,
    actingRole,
    reload,
    createGroup: (name, leaderId) => mutate(() => api.createGroup(name.trim(), leaderId)),
    updateGroup: (groupId, name, leaderId) => mutate(() => api.updateGroup(groupId, name.trim(), leaderId)),
    createVariety: (name) => mutate(() => api.createVariety(name.trim())),
    updateVariety: (varietyId, name) => mutate(() => api.updateVariety(varietyId, name.trim())),
    removeVariety: (varietyId) => mutate(() => api.deleteVariety(varietyId)),
    createNamePrefix: (name) => mutate(() => api.createNamePrefix(name.trim())),
    updateNamePrefix: (prefixId, name) => mutate(() => api.updateNamePrefix(prefixId, name.trim())),
    removeNamePrefix: (prefixId) => mutate(() => api.deleteNamePrefix(prefixId)),
    createFarmer: (input) => mutate(() => api.createFarmer(asFarmerInput(input))),
    updateFarmer: (farmerId, input) => mutate(() => api.updateFarmer(farmerId, asFarmerInput(input))),
    assignFarmer: (farmerId, groupId) => mutate(() => api.assignFarmerGroup(farmerId, groupId)),
    addPlot: async (farmerId, input) => {
      const name = input.name.trim();
      const dedupeKey = [
        farmerId,
        name,
        input.areaRai,
        input.provinceId,
        input.districtId,
        input.subdistrictId,
        JSON.stringify(input.polygon),
      ].join("|");
      if (createPlotInflight.current.has(dedupeKey)) {
        return "กำลังบันทึกแปลงนี้อยู่แล้ว";
      }
      createPlotInflight.current.add(dedupeKey);
      try {
        const body = {
          farmerId,
          name,
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
        // Fast path: create → patch UI → return. Keep ring flags even if API omits hasBoundary.
        const plot = await api.createPlot(body);
        const created = {
          ...plot,
          hasBoundary: plot.hasBoundary || (input.polygon?.length ?? 0) >= 4,
          polygon: plot.polygon.length >= 4 ? plot.polygon : input.polygon ?? plot.polygon,
        };
        patchPlots((plots) => [...plots.filter((item) => item.id !== created.id), created]);
        if (input.preview) {
          try {
            const updated = await api.uploadPlotPreview(created.id, input.preview);
            patchPlots((plots) => plots.map((item) => (item.id === updated.id ? updated : item)));
          } catch {
            // Plot is already saved; still refresh lists so the ring shows.
            setRevision((value) => value + 1);
            return "บันทึกแปลงแล้ว แต่บันทึกรูปตัวอย่างไม่สำเร็จ";
          }
        }
        // Refresh farmer/group plot tables (they listen to revision, not org.plots).
        setRevision((value) => value + 1);
        return null;
      } catch (error) {
        return apiMessage(error);
      } finally {
        // Keep the key briefly so a second click that already passed UI checks still collapses.
        window.setTimeout(() => createPlotInflight.current.delete(dedupeKey), 4000);
      }
    },
    savePlot: (plotId, input) =>
      mutate(async () => {
        let provinceId = input.provinceId;
        let districtId = input.districtId;
        let subdistrictId = input.subdistrictId;
        // Snapshot plots[] is empty (pages live in plotPage / API). Fall back to getPlot.
        if (provinceId == null || districtId == null || subdistrictId == null) {
          const cached =
            dataRef.current.plots.find((item) => item.id === plotId) ??
            dataRef.current.plotPage.items.find((item) => item.id === plotId);
          const current = cached ?? (await api.getPlot(plotId));
          provinceId = provinceId ?? current.provinceId;
          districtId = districtId ?? current.districtId;
          subdistrictId = subdistrictId ?? current.subdistrictId;
        }
        return api.updatePlot(plotId, {
          name: input.name.trim(),
          areaRai: input.areaRai,
          provinceId,
          districtId,
          subdistrictId,
        });
      }),
    saveBoundary: async (plotId, polygon, areaRai, preview) => {
      try {
        const plot = await api.saveBoundary(plotId, polygon, areaRai);
        patchPlots((plots) => plots.map((item) => (item.id === plot.id ? { ...plot, hasBoundary: true } : item)));
        if (preview) {
          try {
            const updated = await api.uploadPlotPreview(plotId, preview);
            patchPlots((plots) => plots.map((item) => (item.id === updated.id ? updated : item)));
          } catch {
            setRevision((value) => value + 1);
            return "บันทึกขอบเขตแล้ว แต่บันทึกรูปตัวอย่างไม่สำเร็จ";
          }
        }
        setRevision((value) => value + 1);
        return null;
      } catch (error) {
        return apiMessage(error);
      }
    },
    removePlot: (plotId) => mutate(() => api.deletePlot(plotId)),
    savePlanting: async (plotId, input) => {
      try {
        const body = {
          varietyId: input.varietyId,
          plantedOn: input.plantedOn,
          harvestOn: input.harvestOn,
          estKg: input.estKg,
        };
        const item = input.plantingId
          ? await api.updatePlanting(input.plantingId, body)
          : await api.createPlanting({ plotId, ...body });
        await reload();
        return { error: null, plantingId: item.id };
      } catch (error) {
        return { error: apiMessage(error), plantingId: null };
      }
    },
    removePlanting: (plantingId) => mutate(() => api.deletePlanting(plantingId)),
    saveActivity: (input) =>
      mutate(() => {
        const body = {
          type: input.type,
          occurredOn: input.occurredOn,
          payload: input.payload,
          note: input.note ?? "",
        };
        return input.id
          ? api.updatePlotActivity(input.id, body)
          : api.createPlotActivity({ plantingId: input.plantingId, ...body });
      }),
    removeActivity: (activityId) => mutate(() => api.deletePlotActivity(activityId)),
    setPermission: (role, resource, flag, on) => mutate(() => api.setPermission(role, resource, flag, on)),
    assignRole: (farmerId, role) => mutate(() => api.assignRole(farmerId, role)),
    revokeRole: (farmerId) => mutate(() => api.revokeRole(farmerId)),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useOrg() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useOrg must be used inside StoreProvider");
  return store;
}
