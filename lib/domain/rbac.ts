import type { SupplierGroup } from "./group";

export type PermissionRole = "org" | "leader" | "member";
export type PermissionResource =
  | "groups"
  | "farmers"
  | "plots"
  | "plantings"
  | "activities"
  | "varieties"
  | "namePrefixes"
  | "announcements";
export type PermissionFlag = "canRead" | "canAdd" | "canEdit" | "canDelete";

export type Permission = {
  role: PermissionRole;
  resource: PermissionResource;
  scope: "all" | "group" | "own";
  canRead: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type RoleGrant = {
  farmerId: string;
  role: "org";
};

export function personRole(grants: RoleGrant[], groups: SupplierGroup[], farmerId: string): PermissionRole {
  if (grants.some((grant) => grant.farmerId === farmerId && grant.role === "org")) return "org";
  if (groups.some((group) => group.leaderId === farmerId)) return "leader";
  return "member";
}

export function roleTitle(role: PermissionRole) {
  if (role === "org") return "องค์กร";
  if (role === "leader") return "หัวหน้ากลุ่ม";
  return "สมาชิก";
}

export function allowed(
  permissions: Permission[],
  role: PermissionRole,
  resource: PermissionResource,
  flag: PermissionFlag,
) {
  if (permissions.some((item) => item.role === role && item.resource === resource && item[flag])) return true;
  if (role === "leader" && permissions.some((item) => item.role === "member" && item.resource === resource && item[flag])) {
    return true;
  }
  return false;
}

