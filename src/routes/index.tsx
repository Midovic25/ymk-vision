import { createFileRoute, Link } from "@tanstack/react-router";
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
      { title: "Yazaki YMK — Plateforme Numérique MOTO" },
      {
        name: "description",
        content:
          "Plateforme numérique de Visual Management, d'audit MOTO et de suivi des plans d'action pour l'usine Yazaki Kenitra.",
      },
      { property: "og:title", content: "Yazaki YMK — Plateforme Numérique MOTO" },
      {
        property: "og:description",
        content:
          "Digitalisation globale du suivi qualité, gestion des audits terrain et suivi en temps réel des plans d'action — Yazaki YMK Kenitra.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, roles } = useCurrentUser();
  const target = user ? primaryRoute(roles) : "/auth";

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
            <Link to={target}>{user ? "Accéder à la plateforme" : "Se connecter"}</Link>
          </Button>
        </div>
      </header>
      <section className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" /> Plateforme Qualité Industrielle
            </div>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Plateforme Numérique de Visual Management
              <span className="block text-primary">& Audit MOTO</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Digitalisation globale du suivi qualité, gestion des audits terrain et suivi en
              temps réel des plans d'action correctifs pour l'usine Yazaki Kenitra. Une source
              unique de vérité, du poste de travail au comité de direction.
            </p>
            <div className="mt-8 flex gap-3">
              <Button size="lg" asChild>
                <Link to={target}>
                  Accéder à la plateforme <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard
              icon={ClipboardCheck}
              title="Audits MOTO terrain"
              text="Hiérarchie Zone › Ligne › Poste › Pilier › Item, notation OK / NG / NA avec preuve photographique."
            />
            <FeatureCard
              icon={AlertTriangle}
              title="Plans d'action correctifs"
              text="Ouverture d'incidents NG, affectation nominative, échéances et évidences de clôture."
            />
            <FeatureCard
              icon={BarChart3}
              title="Pilotage & KPI"
              text="Taux de conformité par ligne, pilier, zone et département — en temps réel."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Rôles & gouvernance"
              text="Administrateur, Responsable MOTO, Responsable Action, Chef de Département."
            />
          </div>
        </div>
      </section>
      <footer className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} Yazaki Morocco · YMK Kenitra</span>
          <span>Plateforme Numérique MOTO · v1.0</span>
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
