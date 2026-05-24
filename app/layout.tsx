import "./globals.css";
import type { ReactNode } from "react";
import ConditionalLayout from "@/components/ConditionalLayout";

export const metadata = {
  title: "360 Procurement Portal - Zambeel",
  description: "Internal procurement workflow portal"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen flex flex-col">
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}

