# Refonte YMK Vision — Plateforme MOTO Visual Management

## Points à valider avant de démarrer

1. **MongoDB (§5)** — l'application tourne sur la base Lovable Cloud (PostgreSQL). Je ne migre pas vers MongoDB, mais je livre une **fonction d'export JSON** (Users, Audits, AuditEntries, ActionPlans, Lines, Areas, Pillars, Items, Workstations) en collections propres, directement importables dans MongoDB plus tard. Les données Excel sont déjà chargées (60 lignes, 15 zones, 4 piliers, 684 items, 7 483 associations poste↔item).
2. **Comptes de test (§4)** — afficher des mots de passe en clair sur la page de connexion d'une plateforme industrielle est un risque. Je crée les 4 comptes et n'affiche le bloc "comptes de démonstration" **que sur l'environnement de préversion**, masqué sur le site publié. Dis-moi si tu veux qu'il soit visible partout.
3. **Email (§2.C)** — l'envoi d'e-mails réels nécessite un domaine d'envoi qui t'appartient. En attendant, la clôture d'audit enregistre les notifications et je branche l'envoi réel dès le domaine configuré.

## 1. Navigation, branding, profil

- Sidebar "Accueil" : lien unique vers `/` si déconnecté, `/dashboard` si connecté (suppression de la logique `primaryRoute` qui provoque la boucle).
- En-tête du sidebar : conteneur clair (fond blanc/carte, coins arrondis) derrière le logo Yazaki pour contraste maximal.
- Profil : upload de photo (stockage privé `avatars`, URL signée), affichée dans l'en-tête et le menu déroulant ; repli sur les initiales.
- En-tête : photo + nom complet + rôle traduit.

## 2. Nouveau parcours d'audit

**Page de configuration (`/audit/new`)** : Ligne, Date, Auditeur (pré-rempli), Plant (YMK/YBEY), puis filtres en cascade Zone → Piliers → Postes. Aperçu du nombre d'items sélectionnés avant lancement.

**Grille d'audit (`/audit/$id`)** — reconstruite :

```text
                 | Poste A | Poste B | Poste C |  ALL
5S / Item 12     |  OK     |  NG     |  NA     | [OK][NG][NA]
5S / Item 13     |  OK     |  OK     |   -     | [OK][NG][NA]
```

- Lignes = items groupés par pilier puis catégorie ; colonnes = postes filtrés.
- Cellules à 3 états (vert / rouge / orange), bouton ALL par ligne, surcharge individuelle possible.
- Score de conformité recalculé en direct dans un bandeau collant.
- Rendu adapté tablette (défilement horizontal, colonne d'items figée).

**Clôture** : deux boutons — "Enregistrer (brouillon)" (audit reste `open`) et "Terminer et clôturer" (score figé, génération automatique d'un ticket d'action par NG, notification au Responsable Action).

## 3. Incident NG et plans d'action

- Formulaire NG déclenché à la sélection : Responsable Action, Zone/Ligne/Poste (pré-remplis), description, photo (import ou prise de vue), date de début, date limite.
- Page "Plans d'action" opérationnelle : liste triée par urgence (retard → échéance proche), fiche détaillée de chaque NG, mise à jour du statut (Not Started / Ongoing / In Delay / Closed), photo de résolution, commentaires.
- KPI par rôle : taux de clôture, retards, avancement.

## 4. RBAC et validation des comptes

- Nouvelle colonne `approved` sur les profils : toute inscription est en attente ; l'admin valide dans Administration. Les non-validés voient un écran "compte en attente".
- Menu latéral et routes filtrés strictement par rôle (Admin / Moto Responsible / Responsable Action / Department Manager), avec redirection propre en cas d'accès non autorisé.
- Admin : statistiques d'usage, création/modification d'utilisateurs, attribution de rôles, réinitialisation de mot de passe, validation des inscriptions.
- Department Manager : supervision par responsable, zone et statut.

## 5. Qualité technique

- Error boundary par route (message clair + bouton "Réessayer") au lieu d'écran blanc.
- Correction des types `null`/`undefined` (`email`, `full_name`, `assignee`).
- Mise en page fluide tablette/PC.

## Détails techniques

- Migrations : `profiles.approved`, `profiles.avatar_url`, `ng_actions.start_date`, `ng_actions.resolution_comment`, `audits.plant`, `audits.area_id`, table `notifications`, bucket `avatars` — avec GRANT et RLS scopés.
- Logique serveur privilégiée (création d'utilisateur, validation, génération du plan d'action à la clôture) via `createServerFn` avec vérification du rôle appelant.
- Export MongoDB via une fonction serveur réservée à l'admin renvoyant un JSON par collection.
