interface ComingSoonPageProps {
  title: string;
  description?: string;
}

export default function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="card flex min-h-[240px] flex-col items-center justify-center text-center">
        <p className="text-lg font-medium text-gray-700">Coming Soon</p>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          This section is under development and will be available in a future update.
        </p>
      </div>
    </div>
  );
}
