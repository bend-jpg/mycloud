// Permissions par rôle staff. Source de vérité unique de la matrice affichée
// dans /admin/staff. Utilisée à la fois :
//   - dans les API routes (via requireBackofficePermission)
//   - dans les pages admin server-side (via canAccessAdminPage / requireRole)
//   - dans la sidebar admin (pour filtrer les liens visibles)

export type StaffRole = "ADMIN" | "STAFF_SUPPORT" | "STAFF_BILLING" | "STAFF_OPS";

export type Permission =
  // Pages
  | "page.overview"
  | "page.clients"
  | "page.client_files" // voir les fichiers d'un client en lecture seule
  | "page.plans"
  | "page.coupons"
  | "page.payments"
  | "page.tickets"
  | "page.storage"
  | "page.staff"
  | "page.cms"
  | "page.audit"
  // Actions
  | "client.modify" // suspendre/supprimer/changer plan/quota
  | "plan.write"
  | "coupon.write"
  | "payment.write" // changer statut, supprimer
  | "ticket.reply"
  | "storage.write"
  | "staff.write"
  | "cms.write";

const MATRIX: Record<StaffRole, Permission[]> = {
  ADMIN: [
    "page.overview",
    "page.clients",
    "page.client_files",
    "page.plans",
    "page.coupons",
    "page.payments",
    "page.tickets",
    "page.storage",
    "page.staff",
    "page.cms",
    "page.audit",
    "client.modify",
    "plan.write",
    "coupon.write",
    "payment.write",
    "ticket.reply",
    "storage.write",
    "staff.write",
    "cms.write",
  ],
  STAFF_SUPPORT: [
    "page.overview",
    "page.clients",
    "page.client_files",
    "page.plans",
    "page.payments",
    "page.tickets",
    "ticket.reply",
  ],
  STAFF_BILLING: [
    "page.overview",
    "page.clients",
    "page.plans",
    "page.coupons",
    "page.payments",
    "page.storage", // pour voir les coûts
    "coupon.write",
    "payment.write",
  ],
  STAFF_OPS: [
    "page.overview",
    "page.clients",
    "page.client_files",
    "page.storage",
    "storage.write",
  ],
};

export function hasPermission(role: string, perm: Permission): boolean {
  const staffRole = role as StaffRole;
  if (!MATRIX[staffRole]) return false;
  return MATRIX[staffRole].includes(perm);
}

/** True si le rôle a au moins un accès au back-office (= peut voir /admin). */
export function canAccessBackoffice(role: string): boolean {
  return role !== "USER" && role in MATRIX;
}

/** Liste des permissions d'un rôle (utile pour debug ou UI). */
export function getPermissionsForRole(role: string): Permission[] {
  return MATRIX[role as StaffRole] ?? [];
}
