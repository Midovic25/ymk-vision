import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeText } from "@/lib/sanitize";
import { assertRateLimit } from "@/lib/rate-limit";
import { askAdvisor, collectAuditSignals } from "@/lib/ai-advisor.server";

export const analyzeAuditData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ question: z.string().max(1000).optional() })
      .transform((v) => ({
        question:
          sanitizeText(v.question, 1000) ||
          "Analyse les résultats d'audit et propose un plan d'amélioration continue prioritaire.",
      }))
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    assertRateLimit(`ai:${context.userId}`, 8, 60_000);
    const signals = await collectAuditSignals(context.supabase);
    const answer = await askAdvisor(signals, data.question);
    return { answer, signals };
  });
