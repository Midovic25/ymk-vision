import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import logoAsset from "@/assets/yazaki_logo.png.asset.json";
import { useCurrentUser, primaryRoute } from "@/hooks/use-current-user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yazaki MOTO — Plateforme d'audit YMK Kenitra" },
      {
        name: "description",
        content:
          "Digitalisation des audits MOTO Visual Management Sheet et suivi des actions correctives — Yazaki Morocco YMK Kenitra.",
      },
      { property: "og:title", content: "Yazaki MOTO — YMK Kenitra" },
      {
        property: "og:description",
        content: "Plateforme industrielle d'audit qualité et suivi terrain.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, roles, loading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: primaryRoute(roles) });
    }
  }, [loading, user, roles, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Yazaki" className="h-9 w-auto" />
            <div className="leading-tight">
              <div className="font-bold text-sm">YAZAKI Morocco</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                YMK Kenitra · MOTO
              </div>
            </div>
          </div>
          <Button asChild variant="default">
            <Link to="/auth">Se connecter</Link>
          </Button>
        </div>
      </header>
      <section className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" /> Enterprise Quality Platform
            </div>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              MOTO Visual Management Sheet
              <span className="block text-primary">100% digitalisé.</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Auditez, notez et pilotez la conformité qualité sur l'ensemble des lignes de
              production YMK Kenitra. Suivi en temps réel des actions correctives, rapports
              automatisés et supervision terrain unifiée.
            </p>
            <div className="mt-8 flex gap-3">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Accéder à la plateforme <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard
              icon={ClipboardCheck}
              title="Saisie d'audit"
              text="Grille dynamique OK / NG / NA avec preuves photo."
            />
            <FeatureCard
              icon={AlertTriangle}
              title="Actions correctives"
              text="Plan d'action, deadline et statut par département."
            />
            <FeatureCard
              icon={BarChart3}
              title="Dashboard Power BI"
              text="Score conformité par ligne, pilier et zone."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Rôles & sécurité"
              text="Admin, auditeur, responsable action, manager."
            />
          </div>
        </div>
      </section>
      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} Yazaki Morocco · YMK Kenitra</span>
          <span>Plateforme MOTO v1.0</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
      <Icon className="h-6 w-6 text-primary" />
      <div className="mt-3 font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground mt-1">{text}</p>
    </div>
  );
}
