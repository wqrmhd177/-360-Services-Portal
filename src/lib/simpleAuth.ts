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

