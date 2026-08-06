import type { CreateProductAvailabilityInput } from "@/lib/productAvailabilityHelpers";

async function postAction<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/product-availability/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

export async function createProductAvailabilityRequestClient(
  input: CreateProductAvailabilityInput,
) {
  const json = await postAction<{ data: unknown }>({ action: "create", input });
  return json.data;
}

export async function cancelProductAvailabilityRequestClient(requestId: string) {
  await postAction({ action: "cancel", requestId });
}

export async function requestAlternativeSearchClient(requestId: string, remarks: string) {
  await postAction({ action: "alternative_search", requestId, remarks });
}

export async function submitProductAvailabilityResponseClient(input: unknown) {
  await postAction({ action: "submit_response", input });
}

export async function createBulkDraftRequestsClient(
  rows: unknown[],
  _userId: string,
  _role: string,
): Promise<{ successCount: number; failedRows: number[] }> {
  const json = await postAction<{ data: { successCount: number; failedRows: number[] } }>({
    action: "bulk_drafts",
    rows,
  });
  return json.data;
}

export async function submitDraftRequestClient(requestId: string, imageUrls: string[]) {
  await postAction({ action: "submit_draft", requestId, imageUrls });
}
