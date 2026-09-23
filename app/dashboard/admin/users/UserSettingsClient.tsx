"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MAIN_TAB_OPTIONS,
  PA_ROLE_OPTIONS,
  PORTAL_DEPARTMENT_OPTIONS,
  PORTAL_ROLE_OPTIONS,
  deriveEffectivePermissions,
  formatMainTabs,
  formatPaRole,
  formatPortalDepartment,
  formatPortalRole,
  parsePermissions,
  type PortalDepartment,
  type PortalRole,
  type ProductAvailabilityRole,
  type UserPermissions,
} from "@/lib/permissions";

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
};

function userToEditState(user: ProfileRow): EditState {
  const parsed = parsePermissions(user.permissions);
  const isPortalAdmin = user.role === "admin";
  const effective = deriveEffectivePermissions({
    role: user.role,
    isAdmin: isPortalAdmin,
    permissions: parsed,
    team: user.team,
  });

  return {
    isPortalAdmin,
    portal_role: isPortalAdmin ? "admin" : effective.portalRole,
    department: (effective.department ?? "") as PortalDepartment | "",
    tabs: {
      operations: effective.tabs.operations,
      product_availability: effective.tabs.product_availability,
      product_listing: effective.tabs.product_listing,
    },
    pa_workflow_role: effective.paRole ?? "agent",
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

  return {
    portal_role: state.portal_role,
    department: state.department || null,
    tabs,
    product_availability: state.tabs.product_availability ? state.pa_workflow_role : null,
    product_listing: state.tabs.product_listing,
    operations: state.tabs.operations,
    zambeel360: [],
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
        pa_workflow_role:
          key === "product_availability" && !next ? prev.pa_workflow_role : prev.pa_workflow_role,
      };
    });
  };

  const handleSave = async () => {
    if (!editingUser || !editState) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions: editStateToPermissions(editState),
          role: editState.isPortalAdmin
            ? "admin"
            : editState.tabs.product_availability
              ? editState.pa_workflow_role
              : "agent",
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
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
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
                      onChange={(e) =>
                        setEditState((prev) =>
                          prev
                            ? { ...prev, portal_role: e.target.value as PortalRole }
                            : prev,
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
                    >
                      {PORTAL_ROLE_OPTIONS.filter((opt) => opt.value !== "admin").map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — {opt.hint}
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
                    <p className="text-sm font-medium text-gray-900">Main tab access</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Home is always available. Sub-tabs inherit the same access as their main tab.
                    </p>
                    <div className="mt-3 space-y-2">
                      {MAIN_TAB_OPTIONS.map((tab) => (
                        <label
                          key={tab.key}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={editState.tabs[tab.key]}
                            onChange={() => toggleTab(tab.key)}
                            className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                          />
                          {tab.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {editState.tabs.product_availability && (
                    <div>
                      <label htmlFor="pa-role" className="text-sm font-medium text-gray-900">
                        Product Availability workflow role
                      </label>
                      <p className="mt-1 text-xs text-gray-500">
                        Controls which requests this user sees inside Product Availability.
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
