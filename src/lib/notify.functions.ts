import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

/**
 * Notifie un Responsable d'Action des non-conformités qui lui sont assignées.
 * Le destinataire est résolu côté serveur depuis l'annuaire des responsables :
 * l'appelant ne fournit jamais d'adresse e-mail.
 */
export const notifyActionResponsible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        context: z.string().max(400),
        items: z.array(z.string().max(300)).min(1).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    assertRateLimit(`mail:${context.userId}`, 30, 60_000);

    const { data: directory, error } = await context.supabase.rpc("list_action_responsibles");
    if (error) throw error;
    const target = (directory ?? []).find((p) => p.id === data.userId);
    if (!target?.email) return { sent: false as const, reason: "unknown_recipient" as const };

    const { sendMail, actionPlanHtml } = await import("@/lib/notify.server");
    const items = data.items.map((i) => sanitizeText(i, 300));
    const result = await sendMail({
      to: target.email,
      subject: `Plan d'action MOTO — ${items.length} non-conformité(s) à traiter`,
      html: actionPlanHtml({
        recipient: target.full_name ?? target.email,
        context: sanitizeText(data.context, 400),
        items,
      }),
    });
    return result;
  });
