"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SuccessModal from "./SuccessModal";

export default function GrowthDashboardWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPrModal, setShowPrModal] = useState(false);
  const [prNumber, setPrNumber] = useState("");

  useEffect(() => {
    if (searchParams == null) return;
    const prCreated = searchParams.get("pr_created");
    if (prCreated) {
      setPrNumber(prCreated);
      setShowPrModal(true);
      // Clean up URL
      router.replace("/dashboard/growth", { scroll: false });
    }
  }, [searchParams, router]);

  return (
    <>
      {children}
      {showPrModal && prNumber && (
        <SuccessModal
          type="pr"
          number={prNumber}
          onClose={() => setShowPrModal(false)}
        />
      )}
    </>
  );
}
