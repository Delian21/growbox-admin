/**
 * Admin actors — one per role (SUPER_ADMIN | OPS | FINANCE | SUPPORT)
 * so every RBAC permission in the mock can be exercised with real logins.
 * Mirrors components.schemas.AdminUser in openapi/admin-v1.yaml.
 */
import type { components } from "@growbox/api-client";

export type AdminUser = components["schemas"]["AdminUser"];

export const ADMINS: AdminUser[] = [
  {
    id: "adm_01J9Z8Q0000000000000000001",
    name: "Ngozi Okafor",
    email: "ngozi@growbox.example",
    role: "SUPER_ADMIN",
    mfa_enrolled: true,
    status: "ACTIVE",
  },
  {
    id: "adm_01J9Z8Q0000000000000000002",
    name: "Chinedu Eze",
    email: "chinedu@growbox.example",
    role: "OPS",
    mfa_enrolled: true,
    status: "ACTIVE",
  },
  {
    id: "adm_01J9Z8Q0000000000000000003",
    name: "Aisha Bello",
    email: "aisha@growbox.example",
    role: "FINANCE",
    mfa_enrolled: true,
    status: "ACTIVE",
  },
  {
    id: "adm_01J9Z8Q0000000000000000004",
    name: "Emeka Obi",
    email: "emeka@growbox.example",
    role: "SUPPORT",
    mfa_enrolled: true,
    status: "ACTIVE",
  },
];

export const ADMIN_BY_ID = new Map(ADMINS.map((a) => [a.id, a]));
