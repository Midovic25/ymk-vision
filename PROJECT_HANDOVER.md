# PROJECT HANDOVER — Yazaki YMK Kenitra · Plateforme d'Audit MOTO

Document de passation technique et fonctionnelle (PRD + Technical Architecture Document).
Version 2.1 — destiné à un développeur Senior ou à un agent IA reprenant le projet.

---

## 1. Résumé du Projet & Objectif Métier

**Contexte.** Yazaki Morocco — usine YMK Kenitra. Les audits MOTO (Visual Management Sheets)
étaient réalisés sur support papier/Excel, sans traçabilité ni pilotage des actions correctives.

**Objectif.** Digitaliser de bout en bout le cycle :

```text
Auditeur MOTO --> Audit terrain (matrice items x postes)
              --> Non-conformités (NG) + preuve photo
              --> Génération automatique du plan d'action
              --> Notification par responsable d'action
              --> Traitement + preuve de correction + commentaire de résolution
              --> Visibilité auditeur / responsable de département / administrateur
```

**Règles métier structurantes**
- Interface intégralement en français, ton industriel formel.
- Inscription réservée aux domaines corporate ; tout nouveau compte doit être validé par
  un administrateur (`profiles.approved`).
- La clôture d'une action corrective exige **un commentaire de résolution ET une photo de preuve**.
- Score d'audit = pourcentage d'items OK sur (OK + NG), les NA étant exclus du calcul.
- L'administrateur pilote les comptes ; il n'exécute ni audit ni action corrective.

---

## 2. Stack Technique Exhaustive

| Couche | Technologie |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR + server functions) |
| Build | Vite 7, déploiement Edge (Cloudflare Workers) |
| Routing | TanStack Router (routes fichiers dans `src/routes`, `routeTree.gen.ts` généré) |
| Données client | TanStack Query v5 |
| Styles | Tailwind CSS v4 (`src/styles.css`, tokens `@theme`), shadcn/ui, Lucide |
| Graphiques | Recharts |
| Validation | Zod (`src/lib/validation.ts`) |
| Backend | Lovable Cloud (PostgreSQL + Auth + Storage + Data API) |
| IA | Lovable AI Gateway (modèle Gemini 2.5 Flash) via AI SDK |
| Emails | Notifications persistées en base + envoi transactionnel groupé |

Pas de React Router, pas de Next.js, pas d'edge functions Supabase : la logique serveur
utilise `createServerFn` (`@tanstack/react-start`) et les routes serveur `src/routes/api/*`.

---

## 3. Schéma de Base de Données

### Tables

| Table | Champs métier | Rôle |
| --- | --- | --- |
| `profiles` | `full_name`, `email`, `department`, `line_id`, `approved`, `approved_at`, `avatar_url` | Miroir applicatif des comptes |
| `user_roles` | `user_id`, `role` (`app_role`) | Habilitations — **table séparée obligatoire** |
| `areas` | `name` | Zones de l'usine (15) |
| `lines` | `name` | Lignes de production (60) |
| `pillars` | `name` | Piliers (5S, CPM, OLS, Y-EMEA PCC) |
| `workstations` | `line_id`, `area_id`, `pillar_id`, `name` | Postes de travail |
| `audit_items` | `code`, `description`, `pillar_id`, `category` | 684 points de contrôle |
| `workstation_items` | `workstation_id`, `item_id` | Mapping poste ↔ item (~28 000 lignes) |
| `audits` | `line_id`, `area_id`, `auditor_id`, `audit_date`, `status`, `score`, `plant`, `closed_at` | En-tête d'audit |
| `audit_entries` | `audit_id`, `workstation_id`, `item_id`, `status` (`OK`/`NG`/`NA`) | Cellule de la matrice |
| `ng_actions` | `entry_id`, `area_id`, `department`, `issue_description`, `evidence_url`, `assigned_to`, `action_plan`, `start_date`, `due_date`, `priority`, `status`, `resolution_comment`, `evidence_correction_url` | Action corrective |
| `notifications` | `user_id`, `action_id`, `channel`, `subject`, `body`, `status` | Journal des envois |

### Énumérations
- `app_role` : `admin`, `moto_responsible`, `action_responsible`, `department_manager`
- `audit_status` : `open`, `closed`
- `entry_status` : `OK`, `NG`, `NA`
- `action_status` : `Not started`, `On going`, `Close`, `In delay`

### Fonctions et triggers
- `private.has_role(uuid, app_role)` / wrapper public `has_role` — SECURITY DEFINER, anti-récursion RLS.
- `private.is_approved(uuid)` — bloque toute écriture d'un compte non validé.
- `private.can_view_audit(uuid)` — auditeur propriétaire, admin, chef de département,
  ou responsable d'action assigné sur une NG de cet audit.
- `private.can_access_evidence(text)` / `evidence_audit_id(text)` — contrôle d'accès Storage.
- `handle_new_user()` (trigger `on_auth_user_created`) — crée le profil, **sans rôle**, `approved = false`.
- `set_updated_at()` (trigger `trg_ng_actions_updated`).

### RLS (principes)
- RLS activée sur toutes les tables ; `GRANT` explicites pour `authenticated` et `service_role`.
- Référentiels (`areas`, `lines`, `pillars`, `workstations`, `audit_items`, `workstation_items`) :
  lecture authentifiée, écriture admin uniquement.
- `audits` / `audit_entries` : lecture via `can_view_audit`, écriture par l'auditeur propriétaire
  ou un admin, sous condition `is_approved`.
- `ng_actions` : lecture par l'assigné, l'auditeur d'origine, l'admin et le chef de département.
- `profiles` : lecture de son propre profil, admin, chef de département, et responsable MOTO
  limité aux responsables d'action (assignation).

### Storage
- `audit-evidence` (privé) — preuves NG et preuves de correction, accès par politique scopée à l'audit.
- `avatars` (privé) — URLs signées à la demande.

---

## 4. Architecture de Sécurité & Rôles

| Rôle | Périmètre applicatif |
| --- | --- |
| **Administrateur** | Comptes, habilitations, validation/suspension/suppression, propriétés des comptes, tableau d'activité. Aucun accès audit/action. |
| **Responsable MOTO (auditeur)** | Tableau de bord, saisie et clôture d'audit, suivi des retours du plan d'action. |
| **Responsable de Département** | Tableau de bord, pilotage de département (avancement des responsables d'action), plan d'action global. |
| **Responsable d'Action** | Espace « Mes actions » trié par priorité puis échéance, plan d'action, preuve de correction. |

**Défense en profondeur**
1. Zod côté client (`src/lib/validation.ts`) : domaine e-mail corporate, mot de passe ≥ 12 caractères.
2. Neutralisation des entrées : `src/lib/sanitize.ts` (balises, protocoles actifs, jokers PostgREST).
3. Limitation de débit applicative : `src/lib/rate-limit.ts` (fenêtre glissante en mémoire).
4. `<RoleGate>` (`src/hooks/use-role-guard.tsx`) — confort UX, **non autoritatif**.
5. RLS PostgreSQL — seule source d'autorité.
6. Secrets exclusivement en variables d'environnement serveur ; clé de service jamais exposée.
7. Messages d'erreur génériques à l'authentification (pas d'énumération de comptes).

---

## 5. Structure Frontend

```text
src/
  routes/
    __root.tsx                    en-tête HTML, providers, Toaster, auth state
    index.tsx                     page publique d'accueil
    auth.tsx                      connexion / inscription + comptes de démonstration
    _authenticated/
      route.tsx                   garde d'accès (ssr:false) + AppShell
      dashboard.tsx               tableau de bord Power BI-like
      audit.index.tsx             historique des audits
      audit.new.tsx               filtres en cascade (Catégorie > Zone > Point > Ligne/Pilier)
      audit.$id.tsx               matrice d'audit + clôture + génération des NG
      actions.tsx                 plan d'action global
      my-actions.tsx              espace responsable d'action
      department.tsx              pilotage de département (Recharts)
      admin.tsx                   gestion des comptes
      accounts.tsx                propriétés des comptes
      activity.tsx                activité des utilisateurs par profil
  components/  AppShell, AppSidebar, RouteErrorBoundary, AiAdvisorCard, ui/*
  hooks/       use-current-user, use-role-guard, use-mobile
  lib/         validation, sanitize, rate-limit, demo-accounts, audit-status,
               admin.functions, ai-advisor.functions, ai-advisor.server
  types/       domain.ts (types métier et libellés FR)
  integrations/supabase/*  (auto-généré — ne pas modifier)
```

**Conventions**
- Chaque route de contenu définit son propre `head()` (titre, description, OG).
- Chaque route définit `errorComponent` via `routeErrorComponent(...)` (aucune fuite technique).
- Lecture des données : TanStack Query ; écriture : mutations + invalidation de clés.

---

## 6. Flux d'Intégration

**Assistant IA.** `AiAdvisorCard` → `src/lib/ai-advisor.functions.ts` (`createServerFn`) →
`src/lib/ai-advisor.server.ts` → Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`,
en-tête `Lovable-API-Key`). Rôle système : ingénieur industriel — analyse des NG,
causes racines (5 Pourquoi / Ishikawa), recommandations correctives. Gérer `429` (débit)
et `402` (crédits épuisés) dans l'UI.

**Notifications.** À la clôture d'un audit, les NG sont regroupées **par responsable d'action**,
une notification unique est produite par destinataire et persistée dans `notifications`
(sujet, corps, statut). Les responsables voient leurs actions triées par priorité puis échéance ;
les réponses (statut, commentaire, preuve) remontent à l'auditeur et au chef de département.

**Administration.** `src/lib/admin.functions.ts` — `deleteUserAccount` (server function,
vérification du rôle admin côté serveur avant usage du client privilégié).

---

## 7. Variables d'Environnement

Client (`import.meta.env`) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID`.

Serveur (`process.env`, lues **dans** les handlers) : `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`.

Voir `.env.example`. Ne jamais préfixer un secret par `VITE_`.

---

## 8. Installation, Déploiement, Maintenance

```bash
bun install
bun run dev        # http://localhost:8080
bunx tsgo --noEmit # contrôle de types
bun run build
```

- **Déploiement recommandé** : publication Lovable (runtime Edge déjà configuré).
- **Déploiement Vercel** : preset TanStack Start, commande `bun run build`, variables
  d'environnement ci-dessus, runtime Node 20+. Retirer toute dépendance Node-only
  (pas de `child_process`, `sharp`, `canvas`).
- **Migrations** : toute évolution de schéma passe par une migration SQL versionnée,
  avec `GRANT` + `ENABLE ROW LEVEL SECURITY` + politiques dans la même migration.
- **Maintenance** : surveiller le linter de sécurité de la base, la consommation IA,
  et purger `notifications` au-delà de la durée de rétention retenue.

---

## 9. Roadmap & Scalabilité

1. **Export réglementaire** : PDF/Excel signé des audits clôturés.
2. **Mode hors-ligne terrain** : file d'attente locale + synchronisation (tablettes atelier).
3. **Notifications temps réel** : abonnements Realtime pour les responsables d'action.
4. **Analytique avancée** : vues matérialisées pour les scores par ligne/pilier/mois,
   indispensable au-delà de ~10⁵ `audit_entries`.
5. **Limitation de débit distribuée** : remplacer le limiteur en mémoire (par isolat)
   par un compteur persistant lorsqu'un quota global sera requis.
6. **Multi-usines** : `plant` est déjà porté par `audits` ; généraliser aux référentiels
   et scoper les politiques RLS par usine.
7. **Journal d'audit (audit trail)** : table append-only des actions sensibles
   (validation, suspension, suppression de compte, clôture d'audit).
