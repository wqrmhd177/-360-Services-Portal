export type MovementHead =
  | "partner"
  | "gold_to_gold"
  | "360_seller_inventory"
  | "360_zambeel_inventory";

export type MovementShippingMode = "road" | "air" | "sea";

export type MovementStatus =
  | "submitted"
  | "pending_approver"
  | "rejected_by_approver"
  | "approved"
  | "in_progress"
  | "completed"
  | "rejected"
  | "canceled";

export type MovementRequest = {
  id: string;
  movement_number: string;
  movement_head: MovementHead;
  created_by_email: string;
  from_sku: string;
  from_country: string;
  from_product_name: string | null;
  to_sku: string;
  to_country: string;
  to_product_name: string | null;
  quantity: number;
  shipping_mode: MovementShippingMode;
  status: MovementStatus;
  approver_email: string | null;
  approver_action_at: string | null;
  approver_remarks: string | null;
  procurement_email: string | null;
  procurement_action_at: string | null;
  procurement_remarks: string | null;
  created_at: string;
  updated_at: string;
};

export type MovementRequestLog = {
  id: number;
  movement_id: string;
  actor_email: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  remarks: string | null;
  created_at: string;
};

export type CreateMovementPayload = {
  movement_head: MovementHead;
  from_sku: string;
  from_country: string;
  from_product_name?: string | null;
  to_sku: string;
  to_country: string;
  to_product_name?: string | null;
  quantity: number;
  shipping_mode: MovementShippingMode;
};

export type UpdateMovementPayload = Partial<CreateMovementPayload> & {
  action?: "resubmit" | "cancel";
};

export const MOVEMENT_HEAD_LABELS: Record<MovementHead, string> = {
  partner: "Partner",
  gold_to_gold: "Gold to Gold",
  "360_seller_inventory": "360 Movements — Seller Inventory",
  "360_zambeel_inventory": "360 Movements — Zambeel Inventory",
};

export const MOVEMENT_STATUS_LABELS: Record<MovementStatus, string> = {
  submitted: "Submitted",
  pending_approver: "Pending Approver",
  rejected_by_approver: "Rejected by Approver",
  approved: "Approved",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
  canceled: "Canceled",
};

export const SHIPPING_MODE_LABELS: Record<MovementShippingMode, string> = {
  road: "By Road",
  air: "By Air",
  sea: "By Sea",
};

export const MOVEMENT_COUNTRY_OPTIONS = [
  "UAE",
  "KSA",
  "KWT",
  "QTR",
  "OMN",
  "BHR",
  "IRQ",
  "PAK",
  "United Arab Emirates",
  "Saudi Arabia",
  "Kuwait",
  "Qatar",
  "Oman",
  "Bahrain",
  "Iraq",
  "Pakistan",
] as const;
