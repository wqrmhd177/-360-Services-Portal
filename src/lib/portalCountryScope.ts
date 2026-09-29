import { normalizeOrderCountry } from "@/lib/country-normalization";

import { parsePermissions, type UserPermissions } from "@/lib/permissions";

import {

  isPortalCountryCode,

  PORTAL_COUNTRY_CODES,

  type PortalCountryCode,

} from "@/lib/portalCountryCodes";

import type { PortalSession } from "@/lib/session";



export {

  isPortalCountryCode,

  PORTAL_COUNTRY_CODES,

  PORTAL_COUNTRY_LABELS,

  type PortalCountryCode,

} from "@/lib/portalCountryCodes";



export type AllowedCountriesConfig = "all" | PortalCountryCode[];



/** Match filter values, market codes, or DB country strings to a portal country code. */

export function portalCountryCodeFromValue(

  value: string | null | undefined,

): PortalCountryCode | null {

  const trimmed = (value ?? "").trim();

  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();

  if (isPortalCountryCode(upper)) return upper;



  const canonical = normalizeOrderCountry(trimmed);

  const byCanonical: Record<string, PortalCountryCode> = {

    "United Arab Emirates": "UAE",

    "Saudi Arabia": "KSA",

    Qatar: "QTR",

    Kuwait: "KWT",

    Oman: "OMN",

    Bahrain: "BHR",

    Iraq: "IRQ",

    "United States": "USA",

    Pakistan: "PAK",

  };

  return byCanonical[canonical] ?? null;

}



export function countryValueInAllowedScope(

  value: string | null | undefined,

  allowed: AllowedCountriesConfig,

): boolean {

  if (allowed === "all") return true;

  const code = portalCountryCodeFromValue(value);

  if (!code) return false;

  return allowed.includes(code);

}



export function resolveAllowedCountries(input: {

  isAdmin?: boolean;

  permissions?: UserPermissions;

}): AllowedCountriesConfig {

  if (input.isAdmin) return "all";

  const raw = input.permissions?.allowedCountries;

  if (raw === undefined || raw === null || raw === "all") return "all";

  if (!Array.isArray(raw)) return "all";

  const codes = raw.filter(isPortalCountryCode);

  return codes.length > 0 ? codes : "all";

}



export function parseAllowedCountriesFromPermissions(

  permissions: UserPermissions | undefined,

): AllowedCountriesConfig {

  return resolveAllowedCountries({ permissions });

}



export function getCountryScopeFromSession(session: PortalSession | null): AllowedCountriesConfig {

  if (!session?.email) return "all";

  const permissions = parsePermissions(session.permissions);

  return resolveAllowedCountries({

    isAdmin: session.isAdmin,

    permissions,

  });

}



export function filterCountryOptions<T extends string>(

  options: T[],

  allowed: AllowedCountriesConfig,

): T[] {

  if (allowed === "all") return options;

  return options.filter((opt) => countryValueInAllowedScope(opt, allowed));

}



export function filterPortalCountryCodes(allowed: AllowedCountriesConfig): PortalCountryCode[] {

  if (allowed === "all") return [...PORTAL_COUNTRY_CODES];

  return allowed;

}



/** If URL country is outside scope, drop it (show all allowed). */

export function clampCountrySearchParam(

  country: string | undefined | null,

  allowed: AllowedCountriesConfig,

): string {

  const trimmed = (country ?? "").trim();

  if (!trimmed) return "";

  if (allowed === "all") return trimmed;

  if (countryValueInAllowedScope(trimmed, allowed)) return trimmed;

  return "";

}



export function enforceSearchParamsCountry(

  searchParams: Record<string, string | string[] | undefined>,

  allowed: AllowedCountriesConfig,

): Record<string, string | string[] | undefined> {

  if (allowed === "all") return searchParams;

  const raw = searchParams.country;

  const country = typeof raw === "string" ? raw : "";

  const clamped = clampCountrySearchParam(country, allowed);

  if (clamped === country) return searchParams;

  return { ...searchParams, country: clamped };

}



export function filterRowsByMarketScope<

  T extends { market?: string | null; markets?: string[] | null },

>(rows: T[], allowed: AllowedCountriesConfig): T[] {

  if (allowed === "all") return rows;

  return rows.filter((row) => {

    const markets = row.markets?.length

      ? row.markets

      : row.market

        ? [row.market]

        : [];

    if (markets.length === 0) return false;

    return markets.some((m) => countryValueInAllowedScope(m, allowed));

  });

}



export function sheetCountryInAllowedScope(

  sheetCountryCode: string,

  allowed: AllowedCountriesConfig,

): boolean {

  return countryValueInAllowedScope(sheetCountryCode, allowed);

}


