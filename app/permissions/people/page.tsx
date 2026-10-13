import { AdminOnly } from "@/components/admin-only";
import { PeoplePermissionsScreen } from "@/components/people-permissions-screen";

export default function Page() {
  return (
    <AdminOnly>
      <PeoplePermissionsScreen />
    </AdminOnly>
  );
}
