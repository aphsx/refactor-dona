import { AdminOnly } from "@/components/admin-only";
import { PermissionsScreen } from "@/components/permissions-screen";

export default function Page() {
  return (
    <AdminOnly>
      <PermissionsScreen />
    </AdminOnly>
  );
}
