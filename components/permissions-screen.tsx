"use client";

import { useState } from "react";
import { useMill } from "@/components/store";
import { PageHeader, TableScroll, tableClass } from "@/components/ui";
import { type PermissionFlag, type PermissionResource, type PermissionRole } from "@/lib/mill";

const ROLES: { role: PermissionRole; title: string; scope: string }[] = [
  { role: "mill", title: "โรงสี", scope: "ทั้งโรงสี" },
  { role: "leader", title: "หัวหน้ากลุ่ม", scope: "เฉพาะอำนาจในกลุ่มที่ตัวเองเป็นหัวหน้า ของตัวเองยังใช้สิทธิ์สมาชิก" },
  { role: "member", title: "สมาชิก", scope: "เฉพาะของตัวเอง" },
];

const RESOURCES: { resource: PermissionResource; label: string }[] = [
  { resource: "groups", label: "กลุ่ม" },
  { resource: "farmers", label: "เกษตรกร" },
  { resource: "plots", label: "แปลง" },
  { resource: "plantings", label: "แผนปลูก" },
];

const FLAGS: { flag: PermissionFlag; label: string }[] = [
  { flag: "canRead", label: "อ่าน" },
  { flag: "canAdd", label: "เพิ่ม" },
  { flag: "canEdit", label: "แก้" },
  { flag: "canDelete", label: "ลบ" },
];

export function PermissionsScreen() {
  const { permissions, setPermission } = useMill();
  const [error, setError] = useState("");

  return (
    <div className="h-full overflow-y-auto px-7 py-6">
      <PageHeader current="จัดการสิทธิ์" />
      <div className="flex flex-col gap-6">
        {ROLES.map((role) => (
          <section key={role.role} className="overflow-hidden rounded-[8px] border border-frame">
            <div className="bg-bar px-6 py-4 text-white">
              <div className="text-[16px] font-bold">{role.title}</div>
              <div className="mt-1 text-[14px] font-normal">{role.scope}</div>
            </div>
            <TableScroll>
              <table className={tableClass}>
                <thead className="bg-table">
                  <tr>
                    <th className="border-r border-white px-5 py-3 font-bold">ข้อมูล</th>
                    {FLAGS.map((flag) => (
                      <th key={flag.flag} className="border-r border-white px-5 py-3 text-center font-bold last:border-r-0">
                        {flag.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((resource, index) => {
                    const permission = permissions.find((item) => item.role === role.role && item.resource === resource.resource);
                    return (
                      <tr key={resource.resource} className={index % 2 === 1 ? "bg-table" : "bg-white"}>
                        <td className="px-5 py-3 font-bold">{resource.label}</td>
                        {FLAGS.map((flag) => (
                          <td key={flag.flag} className="px-5 py-3 text-center">
                            <Flag
                              on={permission?.[flag.flag] ?? false}
                              label={`${role.title} ${resource.label} ${flag.label}`}
                              onToggle={() => {
                                const message = setPermission(role.role, resource.resource, flag.flag, !(permission?.[flag.flag] ?? false));
                                setError(message ?? "");
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </section>
        ))}
        {error && <p className="text-[14px] text-danger">{error}</p>}
      </div>
    </div>
  );
}

function Flag({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-[19px] w-[30px] rounded-full ${on ? "bg-[#00CE92]" : "bg-[#E9E9EB]"}`}
    >
      <span className={`absolute top-px h-[17px] w-[17px] rounded-full bg-white ${on ? "left-3" : "left-px"}`} />
    </button>
  );
}
