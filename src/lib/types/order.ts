export interface MetabaseOrderRow {
  id: number;
  order_number: string;
  country: string;
  full_name: string;
  phone: string;
  shipping: string;
  city: string;
  title: string;
  sku: string;
  quantity: number;
  total_payable: number;
  System_gen_tracking_id_removed: string;
  Courier_tracking_id: string;
  status: string;
  substatus: string;
  tag: string;
  OP_remarks: string;
  NDR_remarks: string | null;
  bifurcation: string;
  Order_date: string;
  updatedAt: string;
  activity_counter: number;
  reschedule_date: string | null;
  shipment_date: string | null;
  approved_date: string | null;
  shipment_date_log: string | null;
  delivered_date: string | null;
  Landing_Tag: string | null;
  store_id: number;
  Undelivered_date: string | null;
  Returned_date: string | null;
  Final_action_date_undelivered: string | null;
  Final_action_tag_undelivered: string | null;
  Update_User: string | null;
  Confirmation_Pending_Date: string | null;
  delivery_partner: string;
  Undelivered_tag: string | null;
  PLATFORM: string;
  Account_Manager: string;
}

export interface OrderLineItem {
  /** Metabase `id` — unique order key for counting and analytics (DB column: order_id). */
  metabaseId: number;
  /** Seller order number (not globally unique; display only). */
  orderNumber: string;
  country: string;
  fullName: string;
  phone: string;
  shipping: string;
  city: string;
  title: string;
  sku: string;
  quantity: number;
  totalPayable: number;
  /** Local payable used for revenue (actual or imputed from title+country history). */
  resolvedPayable?: number;
  payableEstimated?: boolean;
  status: string;
  substatus: string;
  tag: string;
  opRemarks: string;
  bifurcation: string;
  platform: string;
  accountManager: string;
  deliveryPartner: string;
  undeliveredTag: string | null;
  courierTrackingId: string;
  orderDate: Date;
  deliveredDate: Date | null;
  shipmentDate: Date | null;
  shipmentDateLog: Date | null;
  approvedDate: Date | null;
  undeliveredDate: Date | null;
  rescheduleDate: Date | null;
  returnedDate: Date | null;
  updateUser: string | null;
  storeId: number;
  /** ISO currency code from Metabase when available */
  currencyCode?: string;
}

export interface DateRange {
  from: Date;
  to: Date;
  /** yyyy-MM-dd from URL — UTC calendar day for filters */
  fromDate: string;
  toDate: string;
}

export interface OrderFilters {
  countries?: string[];
  statuses?: string[];
  bifurcations?: string[];
  platforms?: string[];
  accountManagers?: string[];
  deliveryPartners?: string[];
  sku?: string;
  storeIds?: number[];
  titles?: string[];
}
