"use client";

export function StatusDetailOrderNumberList({
  orderNumbers,
}: {
  orderNumbers: string[];
}) {
  if (orderNumbers.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-[var(--muted)]">No orders.</p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5 py-1">
      {orderNumbers.map((orderNumber) => (
        <li
          key={orderNumber}
          className="rounded-md border border-[var(--card-border)] bg-[var(--card)] px-2 py-0.5 font-mono text-xs text-[var(--foreground)]"
        >
          {orderNumber}
        </li>
      ))}
    </ul>
  );
}
