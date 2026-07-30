/**
 * Domain layer — canonical, framework-agnostic entities and value objects.
 *
 * These types are the single source of truth used by services, hooks and UI.
 * They intentionally do NOT re-export generated database rows: the persistence
 * shape may change without changing the business contract.
 */

/* ------------------------------- Roles -------------------------------- */

export const APP_ROLES = [
  "admin",
  "moto_responsible",
  "action_responsible",
  "department_manager",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export const ROLE_LABEL_FR: Readonly<Record<AppRole, string>> = {
  admin: "Administrateur",
  moto_responsible: "Responsable MOTO",
  action_responsible: "Responsable Action",
  department_manager: "Chef de Département",
};

/* ------------------------------ Statuses ------------------------------ */

export const ENTRY_STATUSES = ["OK", "NG", "NA"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ACTION_STATUSES = ["Not started", "On going", "In delay", "Close"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABEL_FR: Readonly<Record<ActionStatus, string>> = {
  "Not started": "Non démarrée",
  "On going": "En cours",
  "In delay": "En retard",
  Close: "Clôturée",
};

export const PRIORITIES = ["low", "normal", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL_FR: Readonly<Record<Priority, string>> = {
  low: "Faible",
  normal: "Normale",
  high: "Haute",
  critical: "Critique",
};

export const AUDIT_STATUSES = ["open", "closed"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const PLANTS = ["YMK", "YBEY"] as const;
export type Plant = (typeof PLANTS)[number];

/* ------------------------------ Entities ------------------------------ */

export interface UserProfile {
  readonly id: string;
  readonly email: string | null;
  readonly fullName: string | null;
  readonly department: string | null;
  readonly avatarPath: string | null;
  readonly approved: boolean;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string | null;
  readonly profile: UserProfile | null;
  readonly roles: readonly AppRole[];
}

export interface Line {
  readonly id: string;
  readonly name: string;
  readonly areaId: string | null;
}

export interface Area {
  readonly id: string;
  readonly name: string;
}

export interface Pillar {
  readonly id: string;
  readonly name: string;
}

export interface Workstation {
  readonly id: string;
  readonly name: string;
  readonly lineId: string;
}

export interface AuditItem {
  readonly id: string;
  readonly code: number;
  readonly description: string | null;
  readonly category: string | null;
  readonly pillarId: string | null;
}

export interface Audit {
  readonly id: string;
  readonly lineId: string;
  readonly areaId: string | null;
  readonly auditorId: string;
  readonly auditDate: string;
  readonly plant: Plant | null;
  readonly status: AuditStatus;
  readonly score: number | null;
}

export interface AuditEntry {
  readonly id: string;
  readonly auditId: string;
  readonly itemId: string;
  readonly workstationId: string;
  readonly status: EntryStatus;
}

export interface CorrectiveAction {
  readonly id: string;
  readonly entryId: string | null;
  readonly assignedTo: string | null;
  readonly issueDescription: string;
  readonly actionPlan: string | null;
  readonly resolutionComment: string | null;
  readonly status: ActionStatus;
  readonly priority: Priority;
  readonly department: string | null;
  readonly startDate: string | null;
  readonly dueDate: string | null;
  readonly evidencePath: string | null;
  readonly closingEvidencePath: string | null;
  readonly createdAt: string;
}

/* --------------------------- Result envelope -------------------------- */

/** Explicit success/failure envelope for service calls (no thrown strings). */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type AppErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "network"
  | "unknown";

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly details?: unknown;

  constructor(kind: AppErrorKind, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.kind = kind;
    this.details = details;
  }
}