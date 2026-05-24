import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Link
        href="/"
        className="absolute top-4 left-4 text-sm text-portal-600 hover:text-portal-900"
      >
        ← Back to home
      </Link>
      {children}
    </div>
  );
}
