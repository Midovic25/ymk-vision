/**
 * Validation layer — every user-supplied value crosses one of these schemas
 * before reaching a service or the database. Fail closed, never trust input.
 */
import { z } from "zod";
import { ACTION_STATUSES, ENTRY_STATUSES, PLANTS, PRIORITIES } from "@/types/domain";

/* ------------------------- Corporate email policy ---------------------- */

const RAW_DOMAINS =
  (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS as string | undefined) ?? "yazaki.com";

export const ALLOWED_EMAIL_DOMAINS: readonly string[] = RAW_DOMAINS.split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function emailDomainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export function isCorporateEmail(email: string): boolean {
  const domain = emailDomainOf(email);
  return ALLOWED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export const corporateEmailSchema = z
  .string()
  .trim()
  .min(1, "L'adresse e-mail est obligatoire.")
  .max(254, "Adresse e-mail trop longue.")
  .email("Format d'adresse e-mail invalide.")
  .refine(isCorporateEmail, {
    message: `Seules les adresses professionnelles (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(", ")}) sont autorisées.`,
  });

/* ----------------------------- Password policy ------------------------- */

export const PASSWORD_RULES = [
  { id: "length", label: "12 caractères minimum", test: (v: string) => v.length >= 12 },
  { id: "lower", label: "Une minuscule", test: (v: string) => /[a-z]/.test(v) },
  { id: "upper", label: "Une majuscule", test: (v: string) => /[A-Z]/.test(v) },
  { id: "digit", label: "Un chiffre", test: (v: string) => /\d/.test(v) },
  {
    id: "symbol",
    label: "Un caractère spécial",
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
] as const;

export function passwordChecklist(value: string) {
  return PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, passed: r.test(value) }));
}

export const strongPasswordSchema = z
  .string()
  .max(128, "Mot de passe trop long.")
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Mot de passe : ${rule.label}.` });
      }
    }
  });

/* --------------------------------- Auth -------------------------------- */

export const signInSchema = z.object({
  email: corporateEmailSchema,
  password: z.string().min(1, "Le mot de passe est obligatoire.").max(128),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: corporateEmailSchema,
  password: strongPasswordSchema,
  fullName: z
    .string()
    .trim()
    .min(3, "Le nom complet est obligatoire (3 caractères minimum).")
    .max(120, "Nom complet trop long."),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

/* ------------------------------- Evidence ------------------------------ */

export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const evidenceFileSchema = z
  .instanceof(File, { message: "Une photo est requise." })
  .refine((f) => f.size > 0, "Fichier vide.")
  .refine((f) => f.size <= MAX_EVIDENCE_BYTES, "La photo ne doit pas dépasser 8 Mo.")
  .refine(
    (f) => (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(f.type),
    "Format accepté : JPEG, PNG, WEBP ou HEIC.",
  );

/* ------------------------------ NG incident ---------------------------- */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const ngReportSchema = z
  .object({
    assignedTo: z.string().uuid("Un responsable d'action doit être désigné."),
    issueDescription: z
      .string()
      .trim()
      .min(10, "Décrivez la non-conformité (10 caractères minimum).")
      .max(2000, "Description trop longue."),
    department: z.string().trim().max(120).optional().or(z.literal("")),
    priority: z.enum(PRIORITIES).default("normal"),
    startDate: isoDate,
    dueDate: isoDate,
  })
  .refine((v) => v.dueDate >= v.startDate, {
    path: ["dueDate"],
    message: "L'échéance doit être postérieure ou égale à la date de début.",
  });
export type NgReportInput = z.infer<typeof ngReportSchema>;

/* -------------------------- Corrective action -------------------------- */

export const actionUpdateSchema = z
  .object({
    status: z.enum(ACTION_STATUSES),
    actionPlan: z.string().trim().max(2000).optional().or(z.literal("")),
    resolutionComment: z.string().trim().max(2000).optional().or(z.literal("")),
    dueDate: isoDate.optional().or(z.literal("")),
    /** Existing stored path, if evidence was already uploaded. */
    existingClosingEvidence: z.string().nullable().optional(),
    /** Newly selected file, if any. */
    closingEvidence: z.instanceof(File).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status !== "Close") return;
    if (!v.resolutionComment || v.resolutionComment.trim().length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolutionComment"],
        message: "La clôture exige un commentaire de réalisation (10 caractères minimum).",
      });
    }
    if (!v.closingEvidence && !v.existingClosingEvidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closingEvidence"],
        message: "La clôture exige une photo de preuve après correction.",
      });
    }
    if (v.closingEvidence) {
      const parsed = evidenceFileSchema.safeParse(v.closingEvidence);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["closingEvidence"],
          message: parsed.error.issues[0]?.message ?? "Photo invalide.",
        });
      }
    }
  });
export type ActionUpdateInput = z.infer<typeof actionUpdateSchema>;

/* --------------------------- Audit configuration ----------------------- */

export const auditConfigSchema = z.object({
  lineId: z.string().uuid("Sélectionnez une ligne de production."),
  areaId: z.string().uuid().nullable().optional(),
  auditDate: isoDate,
  plant: z.enum(PLANTS),
  pillarIds: z.array(z.string().uuid()).min(1, "Sélectionnez au moins un pilier MOTO."),
  workstationIds: z.array(z.string().uuid()).min(1, "Sélectionnez au moins un poste."),
});
export type AuditConfigInput = z.infer<typeof auditConfigSchema>;

export const entryStatusSchema = z.enum(ENTRY_STATUSES);

/* ------------------------------ Helpers -------------------------------- */

/** Returns the first human-readable message of a ZodError, or null. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

/** Maps a ZodError to a `{ field: message }` record for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}