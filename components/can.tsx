"use client";

import { useMill } from "@/components/store";
import { allowed, type PermissionFlag, type PermissionResource } from "@/lib/mill";

export function Can({
  resource,
  action,
  children,
}: {
  resource: PermissionResource;
  action: PermissionFlag;
  children: React.ReactNode;
}) {
  const { permissions, actingRole } = useMill();
  if (!allowed(permissions, actingRole, resource, action)) return null;
  return children;
}

export function CanRead({ resource, children }: { resource: PermissionResource; children: React.ReactNode }) {
  return (
    <Can resource={resource} action="canRead">
      {children}
    </Can>
  );
}

export function CanAdd({ resource, children }: { resource: PermissionResource; children: React.ReactNode }) {
  return (
    <Can resource={resource} action="canAdd">
      {children}
    </Can>
  );
}

export function CanEdit({ resource, children }: { resource: PermissionResource; children: React.ReactNode }) {
  return (
    <Can resource={resource} action="canEdit">
      {children}
    </Can>
  );
}

export function CanDelete({ resource, children }: { resource: PermissionResource; children: React.ReactNode }) {
  return (
    <Can resource={resource} action="canDelete">
      {children}
    </Can>
  );
}
