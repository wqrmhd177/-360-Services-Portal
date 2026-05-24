// Currency utility functions

export const getCurrencyByCountry = (
  country: string
): "SAR" | "PKR" | "AED" => {
  if (country === "Saudi Arabia") return "SAR";
  if (country === "Pakistan") return "PKR";
  return "AED"; // Default for all other countries
};

export const getCurrencySymbol = (
  currency: "SAR" | "PKR" | "AED"
): string => {
  const symbols: Record<string, string> = {
    SAR: "ر.س",
    PKR: "₨",
    AED: "د.إ",
  };
  return symbols[currency] || "";
};

export const formatCurrency = (
  amount: number,
  currency: "SAR" | "PKR" | "AED"
): string => {
  // Show ISO currency code instead of locale-specific symbol
  // to keep things consistent across AED / PKR / SAR.
  return `${currency} ${amount.toFixed(2)}`;
};
