import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { analyzeAuditData } from "@/lib/ai-advisor.functions";

const PRESETS = [
  "Quelles sont les non-conformités récurrentes et leurs causes racines ?",
  "Construis un Ishikawa 5M pour le poste le plus critique.",
  "Priorise les actions correctives pour la semaine à venir.",
] as const;

export function AiAdvisorCard() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const analyze = useServerFn(analyzeAuditData);

  const run = useMutation({
    mutationFn: (q: string) => analyze({ data: { question: q } }),
    onSuccess: (r) => setAnswer(r.answer),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Analyse impossible pour le moment."),
  });

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </span>
          Assistant IA · NYS &amp; Amélioration Continue
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Ingénierie industrielle
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Analyse en temps réel des audits enregistrés : détection des récurrences NG, arbre des
          causes (5 Pourquoi / Ishikawa) et propositions d'actions correctives.
        </p>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant="outline"
              disabled={run.isPending}
              onClick={() => {
                setQuestion(p);
                run.mutate(p);
              }}
            >
              {p}
            </Button>
          ))}
        </div>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 1000))}
          maxLength={1000}
          rows={2}
          placeholder="Posez une question métier (ex. : pourquoi le pilier 5S régresse-t-il sur la ligne X ?)"
        />

        <div className="flex items-center gap-2">
          <Button onClick={() => run.mutate(question)} disabled={run.isPending}>
            {run.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Analyser les audits
          </Button>
          {answer && (
            <Button variant="ghost" size="sm" onClick={() => setAnswer(null)}>
              Effacer
            </Button>
          )}
        </div>

        {answer && (
          <div className="max-h-96 overflow-auto rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
