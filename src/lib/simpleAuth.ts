export type UserRole = "growth" | "approver" | "procurement" | "finance" | "admin" | "agent" | "purchaser" | "manager";

/** Team selected at self-signup (organizational unit — not portal access). */
export type SignupTeam =
  | "growth"
  | "operations"
  | "finance"
  | "strategy"
  | "partner_store"
  | "listing_team";

export const SIGNUP_TEAM_OPTIONS: { value: SignupTeam; label: string }[] = [
  { value: "growth", label: "Growth" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "strategy", label: "Strategy" },
  { value: "partner_store", label: "Partner Store" },
  { value: "listing_team", label: "Listing Team" },
];

export function isSignupTeam(team: string): team is SignupTeam {
  return SIGNUP_TEAM_OPTIONS.some((opt) => opt.value === team);
}

export function formatSignupTeamLabel(team: string | null | undefined): string {
  if (!team) return "—";
  const found = SIGNUP_TEAM_OPTIONS.find((opt) => opt.value === team);
  return found?.label ?? team;
}

/** @deprecated Signup uses team only; roles are assigned by admin. */
export const SIGNUP_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "growth", label: "Growth" },
  { value: "approver", label: "Approver" },
  { value: "procurement", label: "Procurement" },
  { value: "finance", label: "Finance" },
];

export function isSignupRole(role: string): role is UserRole {
  return SIGNUP_ROLE_OPTIONS.some((opt) => opt.value === role);
}

/** Roles an admin may assign when a user is not a portal admin. */
export const ASSIGNABLE_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  ...SIGNUP_ROLE_OPTIONS,
  { value: "agent", label: "Agent (Product Availability)" },
  { value: "purchaser", label: "Purchaser (Product Availability)" },
  { value: "manager", label: "Manager (Product Availability)" },
];

export function isAssignableRole(role: string): role is UserRole {
  return ASSIGNABLE_ROLE_OPTIONS.some((opt) => opt.value === role);
}

