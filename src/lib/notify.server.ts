/**
 * Couche d'envoi e-mail (Resend via la passerelle connecteur Lovable).
 * Server-only : la clé API ne quitte jamais le runtime serveur.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

export type MailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_error"; detail?: string };

export async function sendMail({ to, subject, html }: MailPayload): Promise<MailResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) return { sent: false, reason: "not_configured" };

  const from = process.env["RESEND_FROM"] ?? "Yazaki MOTO <onboarding@resend.dev>";
  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Resend gateway error [${response.status}]: ${detail}`);
    return { sent: false, reason: "provider_error", detail: `${response.status}` };
  }
  return { sent: true };
}

export function actionPlanHtml(params: {
  recipient: string;
  context: string;
  items: readonly string[];
}): string {
  const escape = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<div style="font-family:Arial,sans-serif;color:#1a1a1a">
    <h2 style="color:#E60012;margin:0 0 8px">Plateforme MOTO — Yazaki YMK Kenitra</h2>
    <p>Bonjour ${escape(params.recipient)},</p>
    <p>${escape(params.context)}</p>
    <ul>${params.items.map((i) => `<li>${escape(i)}</li>`).join("")}</ul>
    <p>Merci de renseigner le plan d'action, la preuve photo et le statut sur la plateforme.</p>
  </div>`;
}
