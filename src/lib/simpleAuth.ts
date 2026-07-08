export type UserRole = "growth" | "approver" | "procurement" | "finance" | "admin" | "agent" | "purchaser" | "manager";

/** Roles users may self-select at signup. Admin is never assignable via signup. */
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

