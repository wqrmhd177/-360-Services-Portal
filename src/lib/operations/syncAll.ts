import { syncChannelListFromMetabase } from "@/lib/operations/syncChannelList";
import { syncInventoryFromMetabase } from "@/lib/operations/syncInventory";
import { syncOrdersFromMetabase } from "@/lib/operations/syncOrders";

export type SyncAllResult = {
  inventory: { ok: boolean; rowCount: number; error?: string };
  channelList: { ok: boolean; rowCount: number; error?: string };
  orders: { ok: boolean; rowCount: number; error?: string };
};

export async function syncAllOperations(): Promise<SyncAllResult> {
  const inventory = await syncInventoryFromMetabase();
  const channelList = await syncChannelListFromMetabase();
  const orders = await syncOrdersFromMetabase();
  return { inventory, channelList, orders };
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
