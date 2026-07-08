import {
  Banknote,
  CheckSquare,
  ClipboardList,
  FileText,
  Layers,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

const workflowTiles = [
  {
    label: "Quotation Requests",
    icon: FileText,
    color: "from-sky-500/20 to-blue-600/10",
    iconColor: "text-sky-600",
  },
  {
    label: "Purchase Requests",
    icon: ShoppingCart,
    color: "from-violet-500/20 to-purple-600/10",
    iconColor: "text-violet-600",
  },
  {
    label: "Purchase Orders",
    icon: Package,
    color: "from-amber-500/20 to-orange-600/10",
    iconColor: "text-amber-600",
  },
  {
    label: "Approvals",
    icon: CheckSquare,
    color: "from-emerald-500/20 to-green-600/10",
    iconColor: "text-emerald-600",
  },
  {
    label: "Finance",
    icon: Banknote,
    color: "from-rose-500/20 to-pink-600/10",
    iconColor: "text-rose-600",
  },
  {
    label: "Product Availability",
    icon: ClipboardList,
    color: "from-teal-500/20 to-cyan-600/10",
    iconColor: "text-teal-600",
  },
  {
    label: "Logistics",
    icon: Truck,
    color: "from-indigo-500/20 to-indigo-600/10",
    iconColor: "text-indigo-600",
  },
  {
    label: "Teams",
    icon: Users,
    color: "from-portal-500/20 to-portal-700/10",
    iconColor: "text-portal-700",
  },
];

export default function ZyncWelcome({ userName }: { userName?: string }) {
  const greeting = userName?.trim() ? `Welcome back, ${userName.split(" ")[0]}` : "Welcome to Zync";

  return (
    <div className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-3xl border border-portal-200/80 bg-white shadow-soft">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-portal-300/30 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-violet-200/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.15) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-200 bg-portal-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-portal-700">
          <Layers className="h-3.5 w-3.5" />
          Zync Portal
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
          {greeting === "Welcome to Zync" ? (
            <>
              Welcome to{" "}
              <span className="bg-gradient-to-r from-portal-600 via-portal-500 to-sky-600 bg-clip-text text-transparent">
                Zync
              </span>
            </>
          ) : (
            greeting
          )}
        </h1>

        <p className="mt-4 max-w-xl text-lg text-gray-600 md:text-xl">
          Connecting Every Team
        </p>

        <p className="mt-3 max-w-2xl text-sm text-gray-500">
          Your workspace for quotations, purchase requests, orders, finance, product availability,
          and operations — all in one place.
        </p>

        <div className="mt-12 grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
          {workflowTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.label}
                className={`rounded-2xl border border-white/80 bg-gradient-to-br ${tile.color} p-4 shadow-sm backdrop-blur-sm transition-transform hover:-translate-y-0.5`}
              >
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                  <Icon className={`h-5 w-5 ${tile.iconColor}`} />
                </div>
                <p className="text-xs font-medium text-gray-700">{tile.label}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Use the sidebar to open a module and get started.
        </p>
      </div>
    </div>
  );
}
