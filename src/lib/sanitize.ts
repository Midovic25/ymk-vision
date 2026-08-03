/**
 * Neutralisation des entrées utilisateur (défense XSS / injection de contenu).
 * Toute donnée saisie doit traverser ces helpers avant persistance ou envoi
 * vers un service tiers (LLM, e-mail, journalisation).
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-z][\s\S]*?>/gi;
const DANGEROUS_PROTOCOL = /(javascript|data|vbscript)\s*:/gi;

/** Texte libre : supprime balises, protocoles actifs et caractères de contrôle. */
export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, "")
    .replace(HTML_TAGS, "")
    .replace(DANGEROUS_PROTOCOL, "")
    .trim()
    .slice(0, maxLength);
}

/** Identifiant : n'autorise que le format UUID v4 canonique. */
export function sanitizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null;
}

/** Terme de recherche : neutralise les jokers PostgREST (`%`, `_`, `,`, `*`). */
export function sanitizeSearchTerm(value: unknown, maxLength = 80): string {
  return sanitizeText(value, maxLength).replace(/[%_*,()]/g, " ").replace(/\s+/g, " ").trim();
}
