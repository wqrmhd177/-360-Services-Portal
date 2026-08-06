/**
 * ND Report unit tests — FIFO allocation math, eligibility, and undelivered tag rules.
 * Run: npx tsx scripts/run-nd-report-tests.ts
 */

import { isNdUndeliveredLine } from "../src/lib/operations/ndUndeliveredTags";

type OrderLine = {
  orderId: number;
  orderItemId: number;
  quantity: number;
  approvedDate: number;
};

function isNdEligible(status: string): boolean {
  return status === "Approved";
}

function allocateFifo(
  orders: OrderLine[],
  availableInventory: number,
): Array<{ orderId: number; ndQty: number }> {
  const sorted = [...orders].sort((a, b) => {
    if (a.approvedDate !== b.approvedDate) return a.approvedDate - b.approvedDate;
    if (a.orderId !== b.orderId) return a.orderId - b.orderId;
    return a.orderItemId - b.orderItemId;
  });

  let remaining = availableInventory;
  return sorted.map((order) => {
    const allocated = Math.max(0, Math.min(order.quantity, remaining));
    remaining -= allocated;
    return { orderId: order.orderId, ndQty: order.quantity - allocated };
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testEligibility() {
  assert(isNdEligible("Approved"), "Approved is eligible");
  assert(!isNdEligible("Dispatching in Process"), "Dispatching is not eligible");
  assert(!isNdEligible("Shipped"), "Shipped is not eligible");
}

function testFifoFullFirstOrder() {
  const result = allocateFifo(
    [
      { orderId: 1, orderItemId: 10, quantity: 1, approvedDate: 1 },
      { orderId: 2, orderItemId: 20, quantity: 1, approvedDate: 2 },
    ],
    1,
  );
  assert(result[0].ndQty === 0, "First order fulfilled");
  assert(result[1].ndQty === 1, "Second order is ND");
}

function testPartialAllocation() {
  const result = allocateFifo(
    [
      { orderId: 1, orderItemId: 10, quantity: 3, approvedDate: 1 },
      { orderId: 2, orderItemId: 20, quantity: 2, approvedDate: 2 },
    ],
    4,
  );
  assert(result[0].ndQty === 0, "Order A fully fulfilled");
  assert(result[1].ndQty === 1, "Order B partially ND");
  const ndOrders = result.filter((r) => r.ndQty > 0).length;
  const ndQty = result.reduce((sum, r) => sum + r.ndQty, 0);
  assert(ndOrders === 1, "One ND order");
  assert(ndQty === 1, "ND quantity is 1");
}

function testZeroInventory() {
  const result = allocateFifo(
    [{ orderId: 1, orderItemId: 10, quantity: 2, approvedDate: 1 }],
    0,
  );
  assert(result[0].ndQty === 2, "All quantity is ND with zero inventory");
}

function testExactFulfilment() {
  const result = allocateFifo(
    [
      { orderId: 1, orderItemId: 10, quantity: 2, approvedDate: 1 },
      { orderId: 2, orderItemId: 20, quantity: 2, approvedDate: 2 },
    ],
    4,
  );
  assert(result.every((r) => r.ndQty === 0), "All orders fulfilled exactly");
}

function testTieBreakerOrderId() {
  const result = allocateFifo(
    [
      { orderId: 2, orderItemId: 20, quantity: 1, approvedDate: 1 },
      { orderId: 1, orderItemId: 10, quantity: 1, approvedDate: 1 },
    ],
    1,
  );
  assert(result.find((r) => r.orderId === 1)?.ndQty === 0, "Lower order_id wins tie");
  assert(result.find((r) => r.orderId === 2)?.ndQty === 1, "Higher order_id is ND");
}

function testUndeliveredTags() {
  assert(
    isNdUndeliveredLine("Undelivered", "FA - Request to Return"),
    "FA request to return counts",
  );
  assert(
    isNdUndeliveredLine("Undelivered", "FA - Hold for Working"),
    "FA hold for working counts",
  );
  assert(!isNdUndeliveredLine("Undelivered", null), "blank tag excluded");
  assert(!isNdUndeliveredLine("Undelivered", ""), "empty tag excluded");
  assert(!isNdUndeliveredLine("Undelivered", "FA - Other"), "other FA tags excluded");
  assert(!isNdUndeliveredLine("Undelivered", "Manual review"), "non-FA tag excluded");
  assert(!isNdUndeliveredLine("Shipped", "FA - Request to Return"), "wrong status excluded");
}

const tests: Array<[string, () => void]> = [
  ["eligibility rules", testEligibility],
  ["undelivered tag rules", testUndeliveredTags],
  ["FIFO full first order", testFifoFullFirstOrder],
  ["partial allocation", testPartialAllocation],
  ["zero inventory", testZeroInventory],
  ["exact fulfilment", testExactFulfilment],
  ["tie-breaker order_id", testTieBreakerOrderId],
];

let passed = 0;
for (const [name, fn] of tests) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

console.log(`\n${passed} tests passed`);
