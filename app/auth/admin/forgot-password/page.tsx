"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin-forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, confirmPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Unable to reset admin password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push("/auth/admin"), 2500);
    } catch {
      setError("Unexpected error, please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-semibold text-white mb-2">Reset admin password</h1>
        <p className="mb-6 text-sm text-slate-400">
          Use the configured admin email. The new password is saved in Supabase and works on Admin Login.
        </p>

        {success ? (
          <div className="rounded-xl border border-green-900/50 bg-green-950/30 px-4 py-3 text-sm text-green-400 text-center">
            Admin password updated. Redirecting to Admin Login…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Admin email</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Same as PORTAL_ADMIN_EMAIL"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">New password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center bg-amber-500 text-gray-900 hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? "Updating…" : "Reset admin password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/auth/admin" className="text-amber-400 hover:text-amber-300">
            ← Back to Admin Login
          </Link>
        </p>
      </div>
    </div>
  );
}
