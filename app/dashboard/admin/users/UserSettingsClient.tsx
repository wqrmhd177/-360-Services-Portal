"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FEATURE_ACCESS_LEVEL_OPTIONS,
  MAIN_TAB_OPTIONS,
  OPERATIONS_SUBTAB_OPTIONS,
  PA_ROLE_OPTIONS,
  PORTAL_DEPARTMENT_OPTIONS,
  PORTAL_ROLE_OPTIONS,
  PRODUCT_LISTING_SUBTAB_OPTIONS,
  deriveEffectivePermissions,
  formatMainTabs,
  formatPaRole,
  formatPortalDepartment,
  formatPortalRole,
  normalizePortalRole,
  parsePermissions,
  type FeatureAccessLevel,
  type PortalDepartment,
  type PortalRole,
  type ProductAvailabilityRole,
  type UserPermissions,
} from "@/lib/permissions";
import {
  PORTAL_COUNTRY_CODES,
  type PortalCountryCode,
} from "@/lib/portalCountryCodes";
import type { UserRole } from "@/lib/simpleAuth";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  team: string | null;
  permissions: unknown;
};

type EditState = {
  isPortalAdmin: boolean;
  portal_role: PortalRole;
  department: PortalDepartment | "";
  tabs: {
    operations: boolean;
    product_availability: boolean;
    product_listing: boolean;
  };
  pa_workflow_role: ProductAvailabilityRole;
  featureAccess: Record<string, FeatureAccessLevel>;
  countriesAll: boolean;
  selectedCountries: PortalCountryCode[];
};

const PA_FEATURE_KEY = "product_availability";

function keysForMainTab(tab: keyof EditState["tabs"]): string[] {
  if (tab === "operations") return OPERATIONS_SUBTAB_OPTIONS.map((s) => s.key);
  if (tab === "product_listing") return PRODUCT_LISTING_SUBTAB_OPTIONS.map((s) => s.key);
  if (tab === "product_availability") return [PA_FEATURE_KEY];
  return [];
}

function seedFeatureAccessForTab(
  access: Record<string, FeatureAccessLevel>,
  tab: keyof EditState["tabs"],
  enabled: boolean,
): Record<string, FeatureAccessLevel> {
  const next = { ...access };
  const keys = keysForMainTab(tab);
  if (enabled) {
    for (const key of keys) {
      if (!next[key]) next[key] = "read";
    }
  } else {
    for (const key of keys) {
      delete next[key];
    }
    delete next[tab];
  }
  return next;
}

function buildFeatureAccessFromState(state: EditState): Record<string, FeatureAccessLevel> {
  const fa: Record<string, FeatureAccessLevel> = {};
  if (state.tabs.operations) {
    for (const sub of OPERATIONS_SUBTAB_OPTIONS) {
      fa[sub.key] = state.featureAccess[sub.key] ?? "read";
    }
  }
  if (state.tabs.product_listing) {
    for (const sub of PRODUCT_LISTING_SUBTAB_OPTIONS) {
      fa[sub.key] = state.featureAccess[sub.key] ?? "read";
    }
  }
  if (state.tabs.product_availability) {
    fa[PA_FEATURE_KEY] = state.featureAccess[PA_FEATURE_KEY] ?? "read";
  }
  return fa;
}

function profileRoleFromEditState(state: EditState): UserRole {
  if (state.isPortalAdmin) return "admin";
  if (state.portal_role === "manager") return "manager";
  if (state.portal_role === "purchaser") return "purchaser";
  if (state.tabs.product_availability) return state.pa_workflow_role;
  return "agent";
}

function paRoleFromEditState(state: EditState): ProductAvailabilityRole | null {
  if (!state.tabs.product_availability) return null;
  if (state.portal_role === "purchaser") return "purchaser";
  if (state.portal_role === "manager") return "manager";
  return state.pa_workflow_role;
}

function featureAccessFromPermissions(
  parsed: UserPermissions | undefined,
  tabs: EditState["tabs"],
): Record<string, FeatureAccessLevel> {
  const out: Record<string, FeatureAccessLevel> = {};
  const map = parsed?.featureAccess;
  if (tabs.operations) {
    for (const sub of OPERATIONS_SUBTAB_OPTIONS) {
      const val = map?.[sub.key];
      if (val === "read" || val === "write" || val === "none") out[sub.key] = val;
    }
  }
  if (tabs.product_listing) {
    for (const sub of PRODUCT_LISTING_SUBTAB_OPTIONS) {
      const val = map?.[sub.key];
      if (val === "read" || val === "write" || val === "none") out[sub.key] = val;
    }
  }
  if (tabs.product_availability) {
    const val = map?.[PA_FEATURE_KEY];
    if (val === "read" || val === "write" || val === "none") out[PA_FEATURE_KEY] = val;
  }
  return out;
}

function userToEditState(user: ProfileRow): EditState {
  const parsed = parsePermissions(user.permissions);
  const isPortalAdmin = user.role === "admin";
  const effective = deriveEffectivePermissions({
    role: user.role,
    isAdmin: isPortalAdmin,
    permissions: parsed,
    team: user.team,
  });

  const tabFlags = {
      operations: effective.tabs.operations,
      product_availability: effective.tabs.product_availability,
      product_listing: effective.tabs.product_listing,
    };

  let featureAccess = featureAccessFromPermissions(parsed, tabFlags);
  if (tabFlags.operations) {
    featureAccess = seedFeatureAccessForTab(featureAccess, "operations", true);
  }
  if (tabFlags.product_listing) {
    featureAccess = seedFeatureAccessForTab(featureAccess, "product_listing", true);
  }
  if (tabFlags.product_availability) {
    featureAccess = seedFeatureAccessForTab(featureAccess, "product_availability", true);
  }

  const ac = parsed?.allowedCountries;
  const countriesAll = !ac || ac === "all";
  const selectedCountries = countriesAll
    ? [...PORTAL_COUNTRY_CODES]
    : Array.isArray(ac)
      ? [...ac]
      : [...PORTAL_COUNTRY_CODES];

  return {
    isPortalAdmin,
    portal_role: isPortalAdmin ? "admin" : normalizePortalRole(parsed?.portal_role ?? effective.portalRole),
    department: (effective.department ?? "") as PortalDepartment | "",
    tabs: tabFlags,
    pa_workflow_role: effective.paRole ?? "agent",
    featureAccess,
    countriesAll,
    selectedCountries,
  };
}

function editStateToPermissions(state: EditState): UserPermissions {
  if (state.isPortalAdmin) {
    return {
      portal_role: "admin",
      department: state.department || null,
      tabs: {
        home: true,
        operations: true,
        product_availability: true,
        product_listing: true,
        admin_users: true,
      },
      product_availability: "manager",
      product_listing: true,
      operations: true,
      zambeel360: [],
    };
  }

  const tabs = {
    home: true,
    operations: state.tabs.operations,
    product_availability: state.tabs.product_availability,
    product_listing: state.tabs.product_listing,
    admin_users: false,
  };

  const featureAccess = buildFeatureAccessFromState(state);

  return {
    portal_role: state.portal_role,
    department: state.department || null,
    tabs,
    product_availability: paRoleFromEditState(state),
    product_listing: state.tabs.product_listing,
    operations: state.tabs.operations,
    zambeel360: [],
    allowedCountries: state.countriesAll ? "all" : state.selectedCountries,
    ...(Object.keys(featureAccess).length > 0 ? { featureAccess } : {}),
  };
}

export default function UserSettingsClient() {
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to load users");
        }
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = (user.full_name ?? "").toLowerCase();
      const email = user.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, search]);

  const openEdit = (user: ProfileRow) => {
    setEditingUser(user);
    setEditState(userToEditState(user));
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditState(null);
    setSaveError(null);
  };

  const toggleTab = (key: keyof EditState["tabs"]) => {
    if (!editState) return;
    setEditState((prev) => {
      if (!prev) return prev;
      const next = !prev.tabs[key];
      return {
        ...prev,
        tabs: { ...prev.tabs, [key]: next },
        featureAccess: seedFeatureAccessForTab(prev.featureAccess, key, next),
      };
    });
  };

  const setFeatureOverride = (featureKey: string, value: FeatureAccessLevel) => {
    setEditState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        featureAccess: { ...prev.featureAccess, [featureKey]: value },
      };
    });
  };

  const getFeatureOverride = (featureKey: string): FeatureAccessLevel =>
    editState?.featureAccess[featureKey] ?? "read";

  const renderFeatureOverrideSelect = (featureKey: string, label: string, indent = false) => (
    <div
      key={featureKey}
      className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between ${
        indent ? "pl-3" : ""
      }`}
    >
      <span className={`text-gray-700 ${indent ? "text-xs" : "text-sm"}`}>{label}</span>
      <select
        value={getFeatureOverride(featureKey)}
        onChange={(e) => setFeatureOverride(featureKey, e.target.value as FeatureAccessLevel)}
        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900 sm:max-w-[11rem]"
      >
        {FEATURE_ACCESS_LEVEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  const handleSave = async () => {
    if (!editingUser || !editState) return;
    if (!editState.isPortalAdmin && !editState.countriesAll && editState.selectedCountries.length === 0) {
      setSaveError("Select at least one country, or choose All countries.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions: editStateToPermissions(editState),
          role: profileRoleFromEditState(editState),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save permissions");
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, permissions: data.user.permissions, role: data.user.role }
            : u,
        ),
      );
      closeEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex min-h-[200px] items-center justify-center text-sm text-gray-500">
        Loading users…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-sm text-red-600" role="alert">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="card space-y-4 p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
        />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Portal role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Main tabs</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">PA role</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const effective = deriveEffectivePermissions({
                    role: user.role,
                    isAdmin: user.role === "admin",
                    permissions: parsePermissions(user.permissions),
                    team: user.team,
                  });
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatPortalDepartment(effective.department, user.team)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {user.role === "admin"
                          ? "Admin"
                          : formatPortalRole(effective.portalRole)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatMainTabs(effective.tabs)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {effective.tabs.product_availability
                          ? formatPaRole(effective.paRole)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && editState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          onClick={closeEdit}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-user-title" className="text-lg font-semibold text-gray-900">
              Edit user access
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingUser.full_name || editingUser.email} ({editingUser.email})
            </p>

            <div className="mt-6 space-y-5">
              <div className="rounded-lg border border-portal-200 bg-portal-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={editState.isPortalAdmin}
                    onChange={(e) =>
                      setEditState((prev) =>
                        prev ? { ...prev, isPortalAdmin: e.target.checked } : prev,
                      )
                    }
                    className="mt-0.5 rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Portal Admin</span>
                    <span className="mt-0.5 block text-xs text-gray-600">
                      Full read/write access to all tabs, including Admin Users and Data Download.
                    </span>
                  </span>
                </label>
              </div>

              {!editState.isPortalAdmin && (
                <>
                  <div>
                    <label htmlFor="portal-role" className="text-sm font-medium text-gray-900">
                      Portal role
                    </label>
                    <select
                      id="portal-role"
                      value={editState.portal_role}
                      onChange={(e) => {
                        const next = e.target.value as PortalRole;
                        setEditState((prev) => {
                          if (!prev) return prev;
                          const updated: EditState = { ...prev, portal_role: next };
                          if (next === "purchaser") {
                            updated.pa_workflow_role = "purchaser";
                          } else if (next === "manager") {
                            updated.pa_workflow_role = "manager";
                          } else if (
                            next === "growth_agent" ||
                            next === "listing_agent" ||
                            next === "ops_agent"
                          ) {
                            if (
                              prev.pa_workflow_role === "purchaser" ||
                              prev.pa_workflow_role === "manager"
                            ) {
                              updated.pa_workflow_role = "agent";
                            }
                          }
                          return updated;
                        });
                      }}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
                    >
                      {PORTAL_ROLE_OPTIONS.filter((opt) => opt.value !== "admin").map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="department" className="text-sm font-medium text-gray-900">
                      Department
                    </label>
                    <select
                      id="department"
                      value={editState.department}
                      onChange={(e) =>
                        setEditState((prev) =>
                          prev
                            ? {
                                ...prev,
                                department: e.target.value as PortalDepartment | "",
                              }
                            : prev,
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
                    >
                      <option value="">Not set</option>
                      {PORTAL_DEPARTMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900">Country access</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Limits which markets this user sees in Operations, Product Availability, and
                      related filters. Admins always see all countries.
                    </p>
                    <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editState.countriesAll}
                        onChange={(e) =>
                          setEditState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  countriesAll: e.target.checked,
                                  selectedCountries: e.target.checked
                                    ? [...PORTAL_COUNTRY_CODES]
                                    : prev.selectedCountries.length > 0
                                      ? prev.selectedCountries
                                      : [...PORTAL_COUNTRY_CODES],
                                }
                              : prev,
                          )
                        }
                        className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                      />
                      All countries
                    </label>
                    {!editState.countriesAll ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {PORTAL_COUNTRY_CODES.map((code) => {
                          const checked = editState.selectedCountries.includes(code);
                          return (
                            <label
                              key={code}
                              className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setEditState((prev) => {
                                    if (!prev) return prev;
                                    const next = checked
                                      ? prev.selectedCountries.filter((c) => c !== code)
                                      : [...prev.selectedCountries, code];
                                    return { ...prev, selectedCountries: next };
                                  })
                                }
                                className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                              />
                              {code}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900">Main tab access</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Home is always available. Portal role is for identity only — set read, write, or
                      no access on each sub-menu below. No access hides that item from the user menu.
                    </p>
                    <div className="mt-3 space-y-3">
                      {MAIN_TAB_OPTIONS.map((tab) => (
                        <div
                          key={tab.key}
                          className="rounded-lg border border-gray-200 px-3 py-2"
                        >
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={editState.tabs[tab.key]}
                              onChange={() => toggleTab(tab.key)}
                              className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                            />
                            {tab.label}
                          </label>
                          {editState.tabs[tab.key] ? (
                            <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                              {tab.key === "operations"
                                ? OPERATIONS_SUBTAB_OPTIONS.map((sub) =>
                                    renderFeatureOverrideSelect(sub.key, sub.label, true),
                                  )
                                : null}
                              {tab.key === "product_listing"
                                ? PRODUCT_LISTING_SUBTAB_OPTIONS.map((sub) =>
                                    renderFeatureOverrideSelect(sub.key, sub.label, true),
                                  )
                                : null}
                              {tab.key === "product_availability"
                                ? renderFeatureOverrideSelect(
                                    PA_FEATURE_KEY,
                                    "Product Availability",
                                    true,
                                  )
                                : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {editState.tabs.product_availability &&
                    editState.portal_role !== "purchaser" &&
                    editState.portal_role !== "manager" && (
                    <div>
                      <label htmlFor="pa-role" className="text-sm font-medium text-gray-900">
                        Product Availability workflow role
                      </label>
                      <p className="mt-1 text-xs text-gray-500">
                        For Growth, Listing, and Ops agents — controls which requests this user
                        sees inside Product Availability. Purchaser and Manager portal roles use
                        their fixed PA workflow.
                      </p>
                      <select
                        id="pa-role"
                        value={editState.pa_workflow_role}
                        onChange={(e) =>
                          setEditState((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  pa_workflow_role: e.target.value as ProductAvailabilityRole,
                                }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
                      >
                        {PA_ROLE_OPTIONS.filter((opt) => opt.value).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>

            {saveError && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-portal-800 px-4 py-2 text-sm font-medium text-white hover:bg-portal-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
