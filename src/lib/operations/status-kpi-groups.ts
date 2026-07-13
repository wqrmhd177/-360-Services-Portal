export type OperationsStatusGroupId =
  | "confirmationPending"
  | "approved"
  | "dispatching"
  | "shipped"
  | "undelivered"
  | "preDispatchCancelled"
  | "return";

export type OperationsStatusGroupBy = "tag" | "title";

export type OperationsDaysFrom = "orderDate" | "shipmentDateLog";

export type OperationsStatusDetailLayout =
  | "daysCountrySubgroup"
  | "countryTag";

export interface OperationsStatusKpiGroup {
  id: OperationsStatusGroupId;
  title: string;
  statuses: readonly string[];
  groupBy: OperationsStatusGroupBy;
  daysFrom: OperationsDaysFrom;
  detailLayout: OperationsStatusDetailLayout;
}

export const OPERATIONS_STATUS_KPI_GROUPS: readonly OperationsStatusKpiGroup[] = [
  {
    id: "confirmationPending",
    title: "Orders in Confirmation",
    statuses: ["Confirmation Pending"],
    groupBy: "tag",
    daysFrom: "orderDate",
    detailLayout: "daysCountrySubgroup",
  },
  {
    id: "approved",
    title: "Orders in Approved",
    statuses: ["Approved"],
    groupBy: "title",
    daysFrom: "orderDate",
    detailLayout: "daysCountrySubgroup",
  },
  {
    id: "dispatching",
    title: "Orders in Dispatching in Process",
    statuses: ["Dispatching in Process"],
    groupBy: "title",
    daysFrom: "orderDate",
    detailLayout: "daysCountrySubgroup",
  },
  {
    id: "shipped",
    title: "Orders in Shipped",
    statuses: ["Shipped"],
    groupBy: "tag",
    daysFrom: "shipmentDateLog",
    detailLayout: "daysCountrySubgroup",
  },
  {
    id: "undelivered",
    title: "Orders in Undelivered",
    statuses: ["Undelivered"],
    groupBy: "tag",
    daysFrom: "shipmentDateLog",
    detailLayout: "daysCountrySubgroup",
  },
  {
    id: "preDispatchCancelled",
    title: "Pre Dispatch Cancelled",
    statuses: ["Cancelled", "Canceled"],
    groupBy: "tag",
    daysFrom: "orderDate",
    detailLayout: "countryTag",
  },
  {
    id: "return",
    title: "Orders in Return",
    statuses: ["Return in Transit", "Return"],
    groupBy: "tag",
    daysFrom: "shipmentDateLog",
    detailLayout: "countryTag",
  },
] as const;

export function getOperationsStatusGroup(id: string) {
  return OPERATIONS_STATUS_KPI_GROUPS.find((g) => g.id === id);
}
