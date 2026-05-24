"use client";

import { useState, useEffect } from "react";
import type {
  Notification,
  NotificationType,
  NotificationPayload
} from "@/lib/notifications";

interface NotificationCenterProps {
  userEmail: string;
}

function getNotificationTitle(
  type: NotificationType,
  payload: NotificationPayload
): string {
  const qrNumber = payload?.qr_number || "";
  const prNumber = payload?.pr_number || "";
  const poNumber = payload?.po_number || "";

  switch (type) {
    case "qr_created":
      return qrNumber 
        ? `New Quotation Request ${qrNumber}` 
        : "New Quotation Request";
    case "qr_response":
      return qrNumber 
        ? `${qrNumber} - Procurement Response` 
        : "Procurement responded to Quotation Request";
    case "qr_re_edited":
      return qrNumber 
        ? `${qrNumber} - Re-submitted by Procurement` 
        : "Quotation Request re-submitted by Procurement";
    case "pr_approved":
      return prNumber 
        ? `${prNumber} - Approved` 
        : "Purchase Request approved";
    case "pr_rejected":
      return prNumber 
        ? `${prNumber} - Rejected` 
        : "Purchase Request rejected";
    case "pr_finance_verified":
      return prNumber 
        ? `${prNumber} - Payment Verified` 
        : "Payment verified by Finance";
    case "pr_finance_rejected":
      return prNumber 
        ? `${prNumber} - Payment Rejected` 
        : "Payment rejected by Finance";
    case "po_status_changed":
      return poNumber 
        ? `${poNumber} - Status Updated` 
        : "Purchase Order status updated";
    case "po_created":
      return poNumber 
        ? `New Purchase Order ${poNumber}` 
        : "New Purchase Order created";
    default:
      return `Notification: ${type}`;
  }
}

export default function NotificationCenter({ userEmail }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch unread count on mount and periodically so badge shows without opening panel
  async function loadUnreadCount() {
    try {
      const res = await fetch(`/api/notifications/unread-count`);
      if (res.ok) {
        const { count } = await res.json();
        setUnreadCount(count ?? 0);
      }
    } catch (error) {
      console.error("Failed to load unread count:", error);
    }
  }

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [userEmail]);

  useEffect(() => {
    if (!isOpen) return;
    loadNotifications();
    // Poll for new notifications every 30 seconds while panel is open
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [userEmail, isOpen]);

  async function loadNotifications() {
    try {
      const res = await fetch(`/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount((data as Notification[]).filter((n) => !n.read).length);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await fetch(`/api/notifications/read-all`, {
      method: "POST"
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-xl border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-gray-200 p-3">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  No notifications
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.read ? "bg-portal-400/10" : ""
                      }`}
                      onClick={() => !notification.read && handleMarkRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-gray-900 font-semibold">
                            {getNotificationTitle(notification.type, notification.payload)}
                          </p>
                          {notification.payload.message && (
                            <p className="mt-1 text-[10px] text-gray-600 leading-relaxed">
                              {notification.payload.message}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-gray-400">
                            {new Date(notification.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
