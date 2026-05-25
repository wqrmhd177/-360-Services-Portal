import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export async function passwordFields(plainPassword: string) {
  return {
    password: plainPassword,
    password_hash: await bcrypt.hash(plainPassword, 12),
  };
}

export async function passwordMatches(
  input: string,
  profile: { password?: string | null; password_hash?: string | null }
): Promise<boolean> {
  if (profile.password && profile.password === input) {
    return true;
  }
  if (profile.password_hash) {
    return bcrypt.compare(input, profile.password_hash);
  }
  return false;
}

export function validatePasswordReset(
  newPassword: string,
  confirmPassword: string
): string | null {
  if (!newPassword || !confirmPassword) {
    return "New password and confirmation are required.";
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (newPassword !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}
