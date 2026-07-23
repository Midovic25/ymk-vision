# Plateforme Yazaki MOTO — Plan MVP

## Stack
TanStack Start + React 19 + Tailwind v4 + Shadcn + Lucide + Recharts + Lovable Cloud (Supabase managé) + Lovable Emails.

## Étape 1 — Fondations
- Activer Lovable Cloud.
- Charte Yazaki dans `src/styles.css` : primaire rouge `#E60012` (oklch), OK vert, NG rouge, NA orange, neutres noir/gris, radius pro, ombres légères.
- Logo Yazaki uploadé → Lovable Asset, réutilisé Header + Sidebar.
- Layout global : Sidebar rétractable (shadcn Sidebar, `collapsible="icon"`) + Header avec logo + trigger hamburger.

## Étape 2 — Base de données (migrations)
Tables (RLS + GRANT complets) :
- `profiles` (id → auth.users, full_name, email, line_id, department)
- `app_role` enum + `user_roles` + fonction `has_role` security-definer (jamais rôle sur profile)
- `lines`, `pillars`, `areas` (zones), `departments`
- `workstations` (line_id, code, name)
- `audit_items` (pillar_id, area_id, code, description)
- `audits` (line_name, audit_date, auditor_id, status open/closed, score cached, closed_at)
- `audit_entries` (audit_id, item_id, workstation_id, status OK|NG|NA)
- `ng_actions` (entry_id, area_id, department_id, issue_description, evidence_url, assigned_to, action_plan, due_date, evidence_correction_url, status Not started|On going|Close|In delay)
- Bucket Storage `audit-evidence` (public read, upload auth).

## Étape 3 — Seed depuis Excel
- Parser les 2 fichiers XLSX uploadés (`EDS_MF...MVMS...xlsx` + `YMK_Moto_application_lines_data...xlsx`) côté sandbox pour extraire lignes, workstations, piliers, zones, items officiels YMK Kenitra.
- Insérer via migration seed.

## Étape 4 — Auth & rôles
- `/auth` : login email/password + Google (broker Lovable).
- Layout `_authenticated` (géré par intégration).
- Redirection post-login selon rôle : admin → `/admin`, moto_responsible → `/audit`, action_responsible → `/actions`, department_manager → `/dashboard`.
- Trigger `on_auth_user_created` → crée profil.

## Étape 5 — Modules
1. **Dashboard** (`/dashboard`) : KPI cards + Recharts (bar score/ligne, donut OK/NG/NA, line évolution).
2. **Saisie Audit** (`/audit`) : filtres en-tête (ligne, date, pilier, zone), grille items × workstations, boutons `ALL / 1 / 1+`, statuts colorés, modal NG (zone, département, description, evidence upload OU capture caméra via `getUserMedia`), score temps réel, bouton "Close Audit" (>= 1 item) → verrouille + envoie rapport email.
3. **Actions** (`/actions`) : liste NG filtrée, formulaire plan d'action + evidence + statut.
4. **Admin** (`/admin`) : CRUD users/rôles, CRUD lignes/zones/items.
5. **Profil** (`/profile`), Déconnexion.

## Étape 6 — Emails
- Scaffold Lovable Emails.
- Template `audit-report` : HTML récap audit (score, NG list, evidence links).
- Server route `/api/public/*` non requise ; envoi via `sendTemplateEmail` dans server function `closeAudit`.
- Destinataires : auditeur + department manager de la ligne.

## Étape 7 — SEO & finitions
- `head()` par route (titres Yazaki), favicon.
- Sitemap + robots.
- Responsive terrain (tablette).

## Détails techniques
- Routes fichiers : `src/routes/dashboard.tsx`, `_authenticated/audit.tsx`, `_authenticated/audit.$id.tsx`, `_authenticated/actions.tsx`, `_authenticated/admin.tsx`, `_authenticated/profile.tsx`, `auth.tsx`, `index.tsx` (landing publique avec CTA).
- Server functions : `createAudit`, `saveEntry`, `closeAudit`, `createNgAction`, `updateNgAction`, `uploadEvidence` (signed URL) — toutes sous `requireSupabaseAuth`.
- Score calculé côté serveur au close + recalcul dynamique client pendant saisie.
- Upload evidence : Supabase Storage direct depuis client avec session.

## Livraison
1. Enable Cloud → migrations schéma → seed Excel.
2. Design system + layout + sidebar + auth.
3. Modules audit + actions + dashboard + admin.
4. Emails.
5. Publish.

Voulez-vous que je démarre ?
