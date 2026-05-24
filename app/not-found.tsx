import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Page not found</h2>
      <p className="mb-4 text-sm text-gray-600">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Back to home
      </Link>
    </div>
  );
}
