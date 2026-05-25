"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/lib/simpleAuth";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("growth");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, fullName, isSignUp: true })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign up failed");
        setLoading(false);
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch {
      setError("Unexpected error, please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="card max-w-md">
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-center text-gray-900">
          Create an account
        </h2>
        <p className="mb-6 text-sm text-gray-500 text-center">
          Simple internal signup: choose your name, email, password, and role. No Google login required.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-left">
            <label className="block text-xs font-medium text-gray-700">Name</label>
            <input
              type="text"
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="block text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="block text-xs font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-left">
            <label className="block text-xs font-medium text-gray-700">Role</label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-portal-400 focus:ring-2 focus:ring-portal-400/20"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="growth">Growth</option>
              <option value="approver">Approver</option>
              <option value="procurement">Procurement</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin (access all roles)</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading ? "Signing up..." : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/" className="text-portal-600 hover:text-portal-700 font-medium">
            Sign in
          </Link>
          {" · "}
          <Link href="/auth/forgot-password" className="text-portal-600 hover:text-portal-700 font-medium">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}

