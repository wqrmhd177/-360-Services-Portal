import { createSupabaseClient } from "./supabaseClient";

export type NotificationType =
  | "qr_created"
  | "qr_response"
  | "qr_re_edited"
  | "pr_created"
  | "pr_approved"
  | "pr_rejected"
  | "pr_resubmitted"
  | "pr_finance_verified"
  | "pr_finance_rejected"
  | "po_created"
  | "po_status_changed"
  | "pr_reopened"
  | "po_reopened";

export interface NotificationPayload {
  qr_id?: string;
  qr_number?: string;
  pr_id?: string;
  pr_number?: string;
  po_id?: string;
  po_number?: string;
  message?: string;
  reopened_by?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  user_email: string;
  type: NotificationType;
  payload: NotificationPayload;
  read: boolean;
  created_at: string;
}

// Simplified notification system using email directly
// Update schema to use user_email instead of user_id if needed
export async function createNotification(
  userEmail: string,
  type: NotificationType,
  payload: NotificationPayload = {}
) {
  const supabase = createSupabaseClient();

  // For now, we'll use a simplified approach - store email directly
  // You can update the schema to add user_email column or use profiles lookup
  try {
    await supabase.from("notifications").insert({
      user_email: userEmail, // This requires schema update
      type,
      payload
    });
  } catch (error) {
    // If schema doesn't have user_email, fallback to creating profile first
    console.error("Notification creation failed:", error);
  }
}

export async function getNotifications(userEmail: string): Promise<Notification[]> {
  const supabase = createSupabaseClient();

  try {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []) as Notification[];
  } catch (error) {
    // Fallback if schema doesn't support user_email
    return [];
  }
}

export async function getUnreadCount(userEmail: string): Promise<number> {
  const supabase = createSupabaseClient();

  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .eq("read", false);

    if (error) {
      console.error("Failed to get unread notification count:", error);
      return 0;
    }

    return count ?? 0;
  } catch (error) {
    console.error("Unexpected error getting unread notification count:", error);
    return 0;
  }
}

export async function markNotificationRead(notificationId: string, userEmail: string) {
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_email", userEmail);

  if (error) {
    console.error("Failed to mark notification read:", error);
  }
}

export async function markAllNotificationsRead(userEmail: string) {
  const supabase = createSupabaseClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_email", userEmail)
    .eq("read", false);
}

// Get all users with a specific role
export async function getUsersByRole(role: string): Promise<string[]> {
  const supabase = createSupabaseClient();
  
  try {
    console.log(`Getting users with role: ${role}`);
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", role);

    if (error) {
      console.error(`Supabase error getting users with role ${role}:`, error);
      return [];
    }

    const emails = (data ?? []).map((profile: any) => profile.email);
    console.log(`Found ${emails.length} users with role ${role}:`, emails);
    return emails;
  } catch (error) {
    console.error(`Failed to get users with role ${role}:`, error);
    return [];
  }
}

// Notify multiple users at once
export async function notifyMultipleUsers(
  userEmails: string[],
  type: NotificationType,
  payload: NotificationPayload = {}
) {
  const supabase = createSupabaseClient();

  try {
    console.log("=== CREATING NOTIFICATIONS ===");
    console.log("User emails:", userEmails);
    console.log("Type:", type);
    console.log("Payload:", payload);

    const notifications = userEmails.map(email => ({
      user_email: email,
      type,
      payload
    }));

    console.log("Notifications to insert:", notifications);

    const { data, error } = await supabase.from("notifications").insert(notifications);
    
    if (error) {
      console.error("Supabase notification insert error:", error);
    } else {
      console.log("Notifications created successfully:", data);
    }
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}
