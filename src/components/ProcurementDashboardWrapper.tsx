"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SuccessModal from "./SuccessModal";

export default function ProcurementDashboardWrapper({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPoModal, setShowPoModal] = useState(false);
  const [poNumber, setPoNumber] = useState("");

  useEffect(() => {
    if (searchParams == null) return;
    const poCreated = searchParams.get("po_created");
    if (poCreated) {
      setPoNumber(poCreated);
      setShowPoModal(true);
      // Clean up URL
      router.replace("/dashboard/procurement", { scroll: false });
    }
  }, [searchParams, router]);

  return (
    <>
      {children}
      {showPoModal && poNumber && (
        <SuccessModal
          type="po"
          number={poNumber}
          onClose={() => setShowPoModal(false)}
        />
      )}
    </>
  );
}
