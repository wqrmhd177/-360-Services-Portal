"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ZAMBEEL_DEPARTMENT_OPTIONS,
  PA_ROLE_OPTIONS,
  deriveEffectivePermissions,
  formatPaRole,
  formatZambeelPerms,
  parsePermissions,
  type UserPermissions,
  type ZambeelDepartment,
  type ProductAvailabilityRole,
} from "@/lib/permissions";
import { ASSIGNABLE_ROLE_OPTIONS, formatSignupTeamLabel, type UserRole } from "@/lib/simpleAuth";

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
  departmentRole: UserRole;
  zambeel360: ZambeelDepartment[];
  product_availability: ProductAvailabilityRole | "";
  product_listing: boolean;
  operations: boolean;
};

function userToEditState(user: ProfileRow): EditState {
  const parsed = parsePermissions(user.permissions);
  const isPortalAdmin = user.role === "admin";
  const departmentRole: UserRole = isPortalAdmin
    ? "growth"
    : user.role && ASSIGNABLE_ROLE_OPTIONS.some((o) => o.value === user.role)
      ? (user.role as UserRole)
      : "growth";

  return {
    isPortalAdmin,
    departmentRole,
    zambeel360: parsed?.zambeel360 ?? [],
    product_availability: parsed?.product_availability ?? "",
    product_listing: parsed?.product_listing ?? false,
    operations: parsed?.operations ?? false,
  };
}

function editStateToPermissions(state: EditState): UserPermissions {
  return {
    zambeel360: state.zambeel360,
    product_availability: state.product_availability || null,
    product_listing: state.product_listing,
    operations: state.operations,
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

  const toggleZambeel = (dept: ZambeelDepartment) => {
    if (!editState) return;
    setEditState((prev) => {
      if (!prev) return prev;
      const has = prev.zambeel360.includes(dept);
      return {
        ...prev,
        zambeel360: has
          ? prev.zambeel360.filter((d) => d !== dept)
          : [...prev.zambeel360, dept],
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
          role: editState.isPortalAdmin ? "admin" : editState.departmentRole,
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
            : u
        )
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Team</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Zambeel 360</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Product Availability</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Product Listing</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Operations</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const effective = deriveEffectivePermissions({
                    role: user.role,
                    isAdmin: user.role === "admin",
                    permissions: parsePermissions(user.permissions),
                  });
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatSignupTeamLabel(user.team)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {!user.role
                          ? "None"
                          : user.role === "admin"
                            ? "Portal Admin"
                            : user.role}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatZambeelPerms(effective.zambeelPerms)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatPaRole(effective.paRole)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {effective.productListing ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {effective.operations ? "Yes" : "No"}
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
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-user-title" className="text-lg font-semibold text-gray-900">
              Edit permissions
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingUser.full_name || editingUser.email} ({editingUser.email})
              {editingUser.team ? ` · Team: ${formatSignupTeamLabel(editingUser.team)}` : ""}
            </p>

            <div className="mt-6 space-y-5">
              <div className="rounded-lg border border-portal-200 bg-portal-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={editState.isPortalAdmin}
                    onChange={(e) =>
                      setEditState((prev) =>
                        prev ? { ...prev, isPortalAdmin: e.target.checked } : prev
                      )
                    }
                    className="mt-0.5 rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Portal Admin</span>
                    <span className="mt-0.5 block text-xs text-gray-600">
                      Full access to all modules, User Settings, and edit rights across the portal.
                      Only existing admins can grant this.
                    </span>
                  </span>
                </label>
              </div>

              {!editState.isPortalAdmin && (
                <div>
                  <label htmlFor="department-role" className="text-sm font-medium text-gray-900">
                    Primary role
                  </label>
                  <select
                    id="department-role"
                    value={editState.departmentRole}
                    onChange={(e) =>
                      setEditState((prev) =>
                        prev
                          ? { ...prev, departmentRole: e.target.value as UserRole }
                          : prev
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
                  >
                    {ASSIGNABLE_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!editState.isPortalAdmin && (
                <>
              <div>
                <p className="text-sm font-medium text-gray-900">Zambeel 360</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {ZAMBEEL_DEPARTMENT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editState.zambeel360.includes(opt.value)}
                        onChange={() => toggleZambeel(opt.value)}
                        className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="pa-role" className="text-sm font-medium text-gray-900">
                  Product Availability
                </label>
                <select
                  id="pa-role"
                  value={editState.product_availability}
                  onChange={(e) =>
                    setEditState((prev) =>
                      prev
                        ? {
                            ...prev,
                            product_availability: e.target.value as EditState["product_availability"],
                          }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-portal-500 focus:outline-none focus:ring-1 focus:ring-portal-500"
                >
                  {PA_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value || "none"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editState.product_listing}
                    onChange={(e) =>
                      setEditState((prev) =>
                        prev ? { ...prev, product_listing: e.target.checked } : prev
                      )
                    }
                    className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                  />
                  Product Listing access
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editState.operations}
                    onChange={(e) =>
                      setEditState((prev) =>
                        prev ? { ...prev, operations: e.target.checked } : prev
                      )
                    }
                    className="rounded border-gray-300 text-portal-700 focus:ring-portal-500"
                  />
                  Operations access
                </label>
              </div>
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
