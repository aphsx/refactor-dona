import type { VarietyItem } from "./catalog";
import type { Farmer, FarmerPage } from "./farmer";
import type { SupplierGroup } from "./group";
import type { Plot, PlotPage } from "./plot";
import type { Planting, PlotActivity } from "./planting";
import type { Permission, RoleGrant } from "./rbac";

export type OrgSnapshot = {
  farmers: Farmer[];
  /** First page of the member list, loaded with login so the default 20 can paint immediately. */
  farmerPage: FarmerPage;
  groups: SupplierGroup[];
  plots: Plot[];
  /** First page of จัดการแปลง, loaded with login so the default 20 can paint immediately. */
  plotPage: PlotPage;
  plantings: Planting[];
  activities: PlotActivity[];
  varieties: VarietyItem[];
  permissions: Permission[];
  roleGrants: RoleGrant[];
};
