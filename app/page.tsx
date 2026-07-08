"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SIGNUP_TEAM_OPTIONS } from "@/lib/simpleAuth";
import type { SignupTeam } from "@/lib/simpleAuth";
import ZyncAuthHero from "@/components/ZyncAuthHero";

export default function HomePage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState<SignupTeam>("growth");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("signup_pending") === "1") {
      sessionStorage.removeItem("signup_pending");
      setSuccess(
        "Account created. An admin will assign your portal access — you can sign in once that is done."
      );
      setIsSignUp(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const payload = isSignUp
        ? { email, password, team, fullName: name, isSignUp: true }
        : { email, password, isSignUp: false };

      const res = await fetch("/api/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (isSignUp ? "Sign up failed" : "Login failed"));
        setLoading(false);
        return;
      }
      if (isSignUp) {
        setIsSignUp(false);
        setSuccess(data.message ?? "Account created. An admin will assign your portal access.");
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
    <div className="min-h-screen bg-gradient-to-br from-portal-900 via-portal-800 to-portal-700 relative overflow-hidden">
      {/* Background decorative shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-portal-400/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-portal-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-portal-400/20 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2 min-h-[600px]">
            {/* Left Section - Sign In/Sign Up Form */}
            <div className="bg-white p-8 md:p-12 flex flex-col justify-center">
              {/* Logo */}
              <div className="mb-6 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-portal-500 via-portal-400 to-sky-600 tracking-tight">
                  Zync
                </h1>
              </div>

              <h2 className="text-base font-medium text-gray-700 mb-8 text-center">
                {isSignUp ? "Sign up to Zync" : "Sign in to Zync"}
              </h2>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    {!isSignUp && (
                      <Link
                        href="/auth/forgot-password"
                        className="text-xs text-portal-600 hover:text-portal-700 font-medium"
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>

                {isSignUp && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Team</label>
                    <select
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={team}
                      onChange={(e) => setTeam(e.target.value as SignupTeam)}
                    >
                      {SIGNUP_TEAM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {success && (
                  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    {success}
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-portal-800 hover:bg-portal-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (isSignUp ? "Signing up..." : "Signing in...") : (isSignUp ? "Sign Up" : "Sign In")}
                </button>
              </form>

              {/* Sign Up / Sign In Toggle */}
              <div className="mt-6 text-center text-sm text-gray-600">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-portal-600 hover:text-portal-700 font-medium"
                    >
                      Sign In Now
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-portal-600 hover:text-portal-700 font-medium"
                    >
                      Sign Up Now
                    </button>
                  </>
                )}
              </div>
            </div>

            <ZyncAuthHero />
          </div>
        </div>
      </div>
    </div>
  );
}
