import type { OrderLineItem } from "../src/lib/types/order";
import {
  applyOrderLevelFacetFilters,
  getOrderGroupKey,
  groupByOrder,
  normalizeOrderCountry,
  orderMatchesFacetFilters,
} from "../src/lib/analytics/orders";
import { computeOperationsStatusCounts as computeStatus } from "../src/lib/analytics/operations-status-detail";
import { computeStoreVisibilityTables } from "../src/lib/analytics/store-visibility";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function line(partial: Partial<OrderLineItem> & Pick<OrderLineItem, "metabaseId" | "orderNumber">): OrderLineItem {
  return {
    country: "United Arab Emirates",
    fullName: "",
    phone: "",
    shipping: "",
    city: "",
    title: "Product A",
    sku: "SKU-A",
    quantity: 1,
    totalPayable: 100,
    status: "Approved",
    substatus: "",
    tag: "",
    opRemarks: "",
    bifurcation: "Dropshipper",
    platform: "",
    accountManager: "AM",
    deliveryPartner: "Partner",
    undeliveredTag: null,
    courierTrackingId: "",
    orderDate: new Date("2026-07-05T12:00:00Z"),
    deliveredDate: null,
    shipmentDate: null,
    shipmentDateLog: null,
    approvedDate: null,
    undeliveredDate: null,
    rescheduleDate: null,
    returnedDate: null,
    updateUser: null,
    storeId: 1,
    ...partial,
  };
}

function testSameOrderNumberDifferentIds() {
  const items = [
    line({ metabaseId: 1, orderNumber: "ORD-100", sku: "SKU-1" }),
    line({ metabaseId: 2, orderNumber: "ORD-100", sku: "SKU-2" }),
  ];
  assert(groupByOrder(items).size === 2, "same order_number, different Metabase id → 2 orders");
  assert(getOrderGroupKey(items[0]) === "id:1", "group key uses Metabase id");
}

function testFacetAllVsSpecific() {
  const items = [
    line({ metabaseId: 1, orderNumber: "A", country: "Saudi Arabia", bifurcation: "Dropshipper" }),
    line({ metabaseId: 2, orderNumber: "B", country: "Saudi Arabia", bifurcation: "" }),
    line({ metabaseId: 3, orderNumber: "C", country: "", bifurcation: "Dropshipper" }),
    line({ metabaseId: 4, orderNumber: "D", country: "Saudi Arabia", bifurcation: "Marketplace" }),
  ];

  const allAll = applyOrderLevelFacetFilters(items, {});
  assert(groupByOrder(allAll).size === 2, "All/All keeps ids with country+bifurcation (1,4)");

  const dropshipper = applyOrderLevelFacetFilters(items, { bifurcation: "Dropshipper" });
  assert(groupByOrder(dropshipper).size === 1, "Dropshipper filter includes id 1 only");

  const allBif = groupByOrder(applyOrderLevelFacetFilters(items, {})).size;
  const oneBif = groupByOrder(
    applyOrderLevelFacetFilters(items, { bifurcation: "Dropshipper" }),
  ).size;
  assert(allBif >= oneBif, "All bifurcations count >= single bifurcation");
}

function testCountryNormalization() {
  assert(normalizeOrderCountry("UAE") === "United Arab Emirates", "UAE alias");
  const lines = [line({ metabaseId: 1, orderNumber: "X", country: "UAE" })];
  assert(orderMatchesFacetFilters(lines, { country: "United Arab Emirates" }), "UAE matches UAE full name filter");
}

function testStatusCountsByMetabaseId() {
  const items = [
    line({ metabaseId: 10, orderNumber: "S1", status: "Delivered", sku: "A" }),
    line({ metabaseId: 11, orderNumber: "S1", status: "Delivered", sku: "B" }),
    line({ metabaseId: 12, orderNumber: "S2", status: "Approved" }),
  ];
  const counts = computeStatus(items);
  assert(counts.totalOrders === 3, "totalOrders counts unique Metabase ids");
  assert(counts.deliveredOrders === 2, "two delivered ids");
  assert(counts.byGroup.approved === 1, "one approved id");
}

function testStoreVisibilityTables() {
  const items = [
    line({
      metabaseId: 1,
      orderNumber: "A",
      title: "Widget",
      status: "Confirmation Pending",
      tag: "Awaiting callback",
    }),
    line({
      metabaseId: 2,
      orderNumber: "B",
      title: "Widget",
      status: "Delivered",
      tag: "",
    }),
    line({
      metabaseId: 3,
      orderNumber: "C",
      title: "Gadget",
      status: "Undelivered",
      tag: "Customer refused",
    }),
  ];

  const tables = computeStoreVisibilityTables(items);
  assert(tables.productOrders.length === 2, "two products");
  assert(
    tables.productOrders.find((row) => row.product === "Widget")?.orders === 2,
    "Widget has 2 orders",
  );
  assert(
    tables.confirmationReasons[0]?.reason === "Awaiting callback" &&
      tables.confirmationReasons[0]?.orders === 1,
    "confirmation reason by tag",
  );
  assert(
    tables.productDeliveryRatios.find((row) => row.product === "Widget")?.deliveryRatio === 0.5,
    "Widget delivery ratio 50%",
  );
  assert(
    tables.undeliveredReasons[0]?.reason === "Customer refused",
    "undelivered reason by tag",
  );
}

function run() {
  const tests = [
    ["same order_number different ids", testSameOrderNumberDifferentIds],
    ["facet All vs specific", testFacetAllVsSpecific],
    ["country normalization", testCountryNormalization],
    ["status counts by Metabase id", testStatusCountsByMetabaseId],
    ["store visibility tables", testStoreVisibilityTables],
  ];

  for (const [name, fn] of tests as [string, () => void][]) {
    fn();
    console.log(`✓ ${name}`);
  }
  console.log(`\n${tests.length} tests passed`);
}

run();
