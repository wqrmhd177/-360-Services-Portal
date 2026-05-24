"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Admin login failed");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Unexpected error, please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Admin Login</h1>
            <p className="text-sm text-slate-400">Access all roles from one account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin email"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
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
            {loading ? "Signing in…" : "Sign in as Admin"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-amber-400 hover:text-amber-300">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
