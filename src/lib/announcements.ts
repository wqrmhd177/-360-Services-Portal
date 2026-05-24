import { createSupabaseClient } from "./supabaseClient";

export interface Announcement {
  id: string;
  created_at: string;
  created_by_email: string;
  title: string | null;
  body: string;
  role_scope: string | null;
  is_active: boolean;
}

interface CreateAnnouncementInput {
  body: string;
  title?: string;
  roleScope?: string;
  createdByEmail: string;
  isActive?: boolean;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement | null> {
  const supabase = createSupabaseClient();

  const { body, title, roleScope, createdByEmail, isActive } = input;

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      body,
      title: title ?? null,
      role_scope: roleScope ?? null,
      created_by_email: createdByEmail,
      is_active: isActive ?? true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create announcement:", error);
    throw new Error(error.message || "Failed to create announcement in database");
  }

  return data as Announcement;
}

interface GetAnnouncementsOptions {
  limit?: number;
  roleScope?: string;
}

export async function getAnnouncements(options: GetAnnouncementsOptions = {}): Promise<Announcement[]> {
  const supabase = createSupabaseClient();
  const { limit = 20, roleScope } = options;

  let query = supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (roleScope) {
    query = query.eq("role_scope", roleScope);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch announcements:", error);
    return [];
  }

  return (data ?? []) as Announcement[];
}

export async function getActiveAnnouncementForDashboard(): Promise<Announcement | null> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch active announcement:", error);
    return null;
  }

  return (data as Announcement) ?? null;
}

/**
 * Expected Supabase table (SQL for reference):
 *
 * create table if not exists public.announcements (
 *   id uuid primary key default gen_random_uuid(),
 *   created_at timestamptz not null default now(),
 *   created_by_email text not null,
 *   title text,
 *   body text not null,
 *   role_scope text,
 *   is_active boolean not null default true
 * );
 */

