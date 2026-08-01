import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { AppError } from "@/types/domain";

function humanMessage(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.kind) {
      case "unauthorized":
        return "Votre session a expiré. Reconnectez-vous pour continuer.";
      case "forbidden":
        return "Vous n'avez pas les droits nécessaires pour accéder à cette ressource.";
      case "not_found":
        return "La ressource demandée est introuvable.";
      case "network":
        return "Le serveur est momentanément injoignable. Vérifiez votre connexion.";
      default:
        return error.message;
    }
  }
  return "Une erreur inattendue est survenue lors du chargement de cette page.";
}

/**
 * Route-level error boundary. Never leaks a stack trace to the operator:
 * the technical detail goes to the console and to Lovable error capture.
 */
export function RouteErrorBoundary({
  error,
  reset,
  title = "Cette page n'a pas pu être chargée",
}: {
  error: unknown;
  reset?: () => void;
  title?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    reportLovableError(error instanceof Error ? error : new Error(String(error)), {
      boundary: "route_error_boundary",
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <AlertOctagon className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{humanMessage(error)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
          </Button>
          <Button variant="outline" onClick={() => router.navigate({ to: "/" })}>
            <Home className="mr-2 h-4 w-4" /> Accueil
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Factory for the TanStack `errorComponent` route option. */
export function routeErrorComponent(title?: string) {
  return function RouteError({ error, reset }: { error: Error; reset: () => void }) {
    return <RouteErrorBoundary error={error} reset={reset} title={title} />;
  };
}
