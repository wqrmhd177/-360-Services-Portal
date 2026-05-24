/** Display label for QR status (e.g. in badges and tables). */
export function formatQrStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  if (s === "converted_to_pr") return "Converted to PR";
  const withSpaces = s.replace(/_/g, " ");
  if (!withSpaces) return "—";
  return withSpaces
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
