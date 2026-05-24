"use client";

import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "pr" | "po" | "approval" | "finance" | "payment";
  className?: string;
}

export default function StatusBadge({
  status,
  type = "pr",
  className = "",
}: StatusBadgeProps) {
  const getStatusStyles = (): {
    bg: string;
    text: string;
    label: string;
  } => {
    const statusLower = status.toLowerCase();

    // PR Status
    if (type === "pr") {
      if (statusLower === "pending") {
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          label: "Pending Approval",
        };
      }
      if (statusLower === "approved") {
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Approved",
        };
      }
      if (statusLower === "rejected") {
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Rejected",
        };
      }
      if (statusLower === "payment_verified") {
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Payment Verified",
        };
      }
      if (statusLower === "converted_to_po") {
        return {
          bg: "bg-purple-100",
          text: "text-purple-800",
          label: "Converted to PO",
        };
      }
    }

    // Approval Status
    if (type === "approval") {
      if (statusLower === "pending") {
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          label: "Pending Approval",
        };
      }
      if (statusLower === "approved") {
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Approved",
        };
      }
      if (statusLower === "rejected") {
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Rejected",
        };
      }
    }

    // Finance Status
    if (type === "finance") {
      if (statusLower === "pending") {
        return {
          bg: "bg-orange-100",
          text: "text-orange-800",
          label: "Pending Verification",
        };
      }
      if (statusLower === "verified") {
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Payment Verified",
        };
      }
      if (statusLower === "rejected") {
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Payment Rejected",
        };
      }
    }

    // Payment Status
    if (type === "payment") {
      if (statusLower === "paid") {
        return { bg: "bg-green-100", text: "text-green-800", label: "Paid" };
      }
      if (statusLower === "unpaid") {
        return {
          bg: "bg-gray-100",
          text: "text-gray-800",
          label: "Unpaid",
        };
      }
    }

    // PO Status
    if (type === "po") {
      if (
        statusLower === "order_placed" ||
        statusLower === "po_created"
      ) {
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          label: "Order Placed / PO Created",
        };
      }
      if (
        statusLower === "shipment_at_supplier" ||
        statusLower === "shipment_received_at_supplier_warehouse"
      ) {
        return {
          bg: "bg-indigo-100",
          text: "text-indigo-800",
          label: "At Supplier Warehouse",
        };
      }
      if (statusLower === "shipment_received_at_lp_warehouse") {
        return {
          bg: "bg-purple-100",
          text: "text-purple-800",
          label: "At LP Warehouse",
        };
      }
      if (statusLower === "shipment_received_at_destination_city") {
        return {
          bg: "bg-pink-100",
          text: "text-pink-800",
          label: "At Destination City",
        };
      }
      if (statusLower === "shipment_received_at_destination_warehouse") {
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "At Destination Warehouse",
        };
      }
      if (statusLower === "delivered") {
        return {
          bg: "bg-green-100",
          text: "text-green-800",
          label: "Delivered",
        };
      }
      if (statusLower === "canceled") {
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Canceled",
        };
      }
    }

    // Default
    return {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };
  };

  const { bg, text, label } = getStatusStyles();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text} ${className}`}
    >
      {label}
    </span>
  );
}
