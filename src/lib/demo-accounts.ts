/**
 * Registre des comptes de démonstration provisionnés pour la recette.
 * Les mots de passe réels des comptes de production sont stockés hachés par
 * le fournisseur d'authentification et ne sont récupérables par personne :
 * seules ces identités de test disposent d'un secret connu et documenté.
 */
export interface DemoAccount {
  role: string;
  roleKey: "admin" | "moto_responsible" | "department_manager" | "action_responsible";
  email: string;
  password: string;
  scope: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: "Administrateur",
    roleKey: "admin",
    email: "admin@yazaki-europe.com",
    password: "Admin@Yazaki2026",
    scope: "Pilotage plateforme",
  },
  {
    role: "Auditeur MOTO",
    roleKey: "moto_responsible",
    email: "auditor@yazaki-europe.com",
    password: "Audit@Yazaki2026",
    scope: "Saisie et clôture des audits",
  },
  {
    role: "Responsable Département",
    roleKey: "department_manager",
    email: "dept.manager@yazaki-europe.com",
    password: "Manager@Yazaki2026",
    scope: "Pilotage des responsables d'action",
  },
  {
    role: "Responsable d'Action 1",
    roleKey: "action_responsible",
    email: "action.resp1@yazaki-europe.com",
    password: "Action@Yazaki2026",
    scope: "Production",
  },
  {
    role: "Responsable d'Action 2",
    roleKey: "action_responsible",
    email: "action.resp2@yazaki-europe.com",
    password: "Action@Yazaki2026",
    scope: "Qualité",
  },
  {
    role: "Responsable d'Action 3",
    roleKey: "action_responsible",
    email: "action.resp3@yazaki-europe.com",
    password: "Action@Yazaki2026",
    scope: "Maintenance",
  },
  {
    role: "Responsable d'Action 4",
    roleKey: "action_responsible",
    email: "action.resp4@yazaki-europe.com",
    password: "Action@Yazaki2026",
    scope: "Logistique",
  },
];