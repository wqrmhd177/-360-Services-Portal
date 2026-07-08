"use client";

/** Admin accounts have full portal access; this hook is kept for compatibility. */
export function useReadOnlyAdmin(): boolean {
  return false;
}
