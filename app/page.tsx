"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/lib/simpleAuth";

export default function HomePage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
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
      const payload = isSignUp 
        ? { email, password, role, fullName: name, isSignUp: true }
        : { email, password, isSignUp: false };

      const res = await fetch("/api/simple-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (isSignUp ? "Sign up failed" : "Login failed"));
        setLoading(false);
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
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
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-portal-400 via-portal-300 to-portal-600 tracking-tight">
                  360 Procurement
                </h1>
              </div>

              {/* Heading */}
              <h2 className="text-base font-medium text-gray-700 mb-8 text-center">
                {isSignUp ? "Sign up to 360 Procurement" : "Sign in to 360 Procurement"}
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
                      <span className="text-xs text-gray-400">
                        Forgot your password? Contact your admin.
                      </span>
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
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                      }}
                      className="text-portal-600 hover:text-portal-700 font-medium"
                    >
                      Sign Up Now
                    </button>
                  </>
                )}
              </div>

              {/* Admin Login */}
              <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                <Link
                  href="/auth/admin"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Admin Login — access all roles
                </Link>
              </div>
            </div>

            {/* Right Section - Promotional Content */}
            <div className="bg-white p-8 md:p-12 flex flex-col justify-center items-center text-center">
              {/* Headline */}
              <div className="mb-8">
                <h3 className="text-4xl md:text-5xl font-bold mb-2">
                  <span className="text-blue-900">Number 1</span>
                </h3>
                <h3 className="text-4xl md:text-5xl font-bold mb-2">
                  <span className="text-orange-500">Cross-Border</span>
                </h3>
                <h3 className="text-4xl md:text-5xl font-bold mb-2">
                  <span className="text-orange-500">Procurement</span>
                </h3>
                <h3 className="text-4xl md:text-5xl font-bold">
                  <span className="text-blue-900">Partner!</span>
                </h3>
              </div>

              {/* Composite Image Placeholder - Using CSS to create a visual representation */}
              <div className="relative w-full max-w-md h-64 mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                  {/* Laptop */}
                  <div className="absolute z-20 w-32 h-20 bg-gray-300 rounded-lg shadow-lg">
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-36 h-1 bg-gray-400 rounded"></div>
                    <div className="absolute inset-2 bg-white rounded"></div>
                  </div>
                  {/* Airplane */}
                  <div className="absolute top-8 right-8 z-30">
                    <svg className="w-16 h-16 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                    </svg>
                  </div>
                  {/* Ship */}
                  <div className="absolute bottom-8 left-8 z-10">
                    <svg className="w-20 h-20 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                    </svg>
                  </div>
                  {/* Truck */}
                  <div className="absolute bottom-4 right-12 z-10">
                    <svg className="w-16 h-16 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                    </svg>
                  </div>
                  {/* Boxes */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 z-10">
                    <div className="w-6 h-6 bg-amber-600 rounded shadow"></div>
                    <div className="w-6 h-6 bg-amber-700 rounded shadow"></div>
                    <div className="w-6 h-6 bg-amber-800 rounded shadow"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
