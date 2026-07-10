import { syncChannelListFromMetabase } from "@/lib/operations/syncChannelList";
import { syncInventoryFromMetabase } from "@/lib/operations/syncInventory";

export type SyncAllResult = {
  inventory: { ok: boolean; rowCount: number; error?: string };
  channelList: { ok: boolean; rowCount: number; error?: string };
};

export async function syncAllOperations(): Promise<SyncAllResult> {
  const inventory = await syncInventoryFromMetabase();
  const channelList = await syncChannelListFromMetabase();
  return { inventory, channelList };
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
