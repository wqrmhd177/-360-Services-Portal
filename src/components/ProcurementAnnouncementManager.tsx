"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  created_at: string;
  created_by_email: string;
  title: string | null;
  body: string;
  is_active: boolean;
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch("/api/announcements");
  if (!res.ok) {
    return [];
  }
  return res.json();
}

interface Props {
  initialAnnouncements: Announcement[];
}

export default function ProcurementAnnouncementManager({ initialAnnouncements }: Props) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [setActive, setSetActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialAnnouncements.length === 0) {
      setLoading(true);
      fetchAnnouncements()
        .then((data) => setAnnouncements(data))
        .finally(() => setLoading(false));
    }
  }, [initialAnnouncements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!content.trim()) {
      setError("Announcement content is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          title: title.trim() || undefined,
          isActive: setActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to push announcement.");
        return;
      }

      const created: Announcement = await res.json();
      setAnnouncements((prev) => [created, ...prev]);
      setContent("");
      setTitle("");
      setSetActive(true);
      setSuccess("Announcement pushed successfully.");
    } catch {
      setError("Failed to push announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Create Announcement</h2>
          <p className="text-sm text-gray-500">
            Add a message about your availability or important procurement updates. This can be shown as
            a banner on the dashboard for all users.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="title">
            Title (optional)
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="e.g. China Holidays 2026"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="content">
            Announcement content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={4}
            placeholder='e.g. "The official Holidays in China are from 15 Feb 2026 to 23 Feb 2026."'
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="setActive"
            type="checkbox"
            checked={setActive}
            onChange={(e) => setSetActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="setActive" className="text-sm text-gray-700">
            Set as active (show in banner)
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Pushing…" : "Push announcement"}
        </button>
      </form>

      <div className="border-t border-gray-200 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Past announcements</h2>
          {loading && <span className="text-xs text-gray-500">Loading…</span>}
        </div>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements have been shared yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Created At</th>
                  <th className="px-2 py-2 font-medium">Title</th>
                  <th className="px-2 py-2 font-medium">Content</th>
                  <th className="px-2 py-2 font-medium">Active</th>
                  <th className="px-2 py-2 font-medium">Created By</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-2 py-2 text-gray-900">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-900">{a.title || "—"}</td>
                    <td className="px-2 py-2 text-gray-900">
                      {a.body.length > 120 ? `${a.body.slice(0, 117)}…` : a.body}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          a.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-gray-50 text-gray-600 ring-1 ring-gray-200"
                        }`}
                      >
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-gray-900">{a.created_by_email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

