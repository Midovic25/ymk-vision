import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import logoAsset from "@/assets/yazaki_logo.png.asset.json";
import { useCurrentUser, primaryRoute } from "@/hooks/use-current-user";
import {
  ALLOWED_EMAIL_DOMAINS,
  fieldErrors,
  passwordChecklist,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";
import { Check, X } from "lucide-react";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { routeErrorComponent } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Yazaki MOTO" },
      { name: "description", content: "Connexion à la plateforme d'audit MOTO YMK Kenitra." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
  errorComponent: routeErrorComponent("Page de connexion indisponible"),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, roles, loading } = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const checklist = useMemo(() => passwordChecklist(password), [password]);
  const domainHint = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" · ");

  useEffect(() => {
    if (!loading && user) navigate({ to: primaryRoute(roles) });
  }, [loading, user, roles, navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);
    if (error) {
      // Generic message: never disclose whether the account exists.
      return toast.error("Identifiants invalides ou compte non autorisé.");
    }
    toast.success("Connecté");
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ email, password, fullName, department });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast.error("Veuillez corriger les champs signalés.");
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.fullName,
          department: parsed.data.department || null,
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Compte créé. Un administrateur activera votre rôle.");
  }

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(result.error.message ?? "Erreur Google");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logoAsset.url} alt="Yazaki" className="h-14 mb-3" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            YMK Kenitra · MOTO Platform
          </div>
        </div>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Accès plateforme</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-4">
                  <div>
                    <Label>Email professionnel</Label>
                    <Input
                      type="email"
                      autoComplete="username"
                      placeholder={`prenom.nom${ALLOWED_EMAIL_DOMAINS[0] ? `@${ALLOWED_EMAIL_DOMAINS[0]}` : ""}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <FieldError message={errors.email} />
                  </div>
                  <div>
                    <Label>Mot de passe</Label>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <FieldError message={errors.password} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Se connecter
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 pt-4">
                  <div>
                    <Label>Nom complet</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                    <FieldError message={errors.fullName} />
                  </div>
                  <div>
                    <Label>Département (optionnel)</Label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Production, Qualité, Maintenance…"
                    />
                    <FieldError message={errors.department} />
                  </div>
                  <div>
                    <Label>Email professionnel</Label>
                    <Input
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Domaines autorisés : {domainHint}
                    </p>
                    <FieldError message={errors.email} />
                  </div>
                  <div>
                    <Label>Mot de passe</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                    />
                    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                      {checklist.map((r) => (
                        <li
                          key={r.id}
                          className={`flex items-center gap-1 text-[11px] ${
                            r.passed ? "text-[var(--status-ok)]" : "text-muted-foreground"
                          }`}
                        >
                          {r.passed ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                          {r.label}
                        </li>
                      ))}
                    </ul>
                    <FieldError message={errors.password} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Toute inscription est soumise à la validation d'un administrateur avant
                    l'attribution d'un rôle et l'accès aux données de production.
                  </p>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Créer un compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase">Ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={googleSignIn}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuer avec Google
            </Button>
          </CardContent>
        </Card>
        <TestAccountsPanel
          onSelect={(e, p) => {
            setEmail(e);
            setPassword(p);
            setErrors({});
            toast.info("Identifiants pré-remplis — cliquez sur « Se connecter ».");
          }}
        />
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function TestAccountsPanel({
  onSelect,
}: {
  onSelect: (email: string, password: string) => void;
}) {
  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Comptes de démonstration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => onSelect(a.email, a.password)}
            className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold">
                {a.role} <span className="font-normal text-muted-foreground">· {a.scope}</span>
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{a.email}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {a.password}
            </span>
          </button>
        ))}
        <p className="text-[11px] text-muted-foreground">
          Cliquez sur un compte pour pré-remplir le formulaire de connexion.
        </p>
      </CardContent>
    </Card>
  );
}