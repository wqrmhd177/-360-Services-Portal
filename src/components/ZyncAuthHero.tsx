import {
  ArrowRight,
  Banknote,
  CheckSquare,
  FileText,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

const flowSteps = [
  { label: "QR", icon: FileText, tone: "bg-sky-100 text-sky-700" },
  { label: "PR", icon: ShoppingCart, tone: "bg-violet-100 text-violet-700" },
  { label: "Approve", icon: CheckSquare, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Finance", icon: Banknote, tone: "bg-amber-100 text-amber-700" },
  { label: "PO", icon: Package, tone: "bg-rose-100 text-rose-700" },
];

export default function ZyncAuthHero() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-portal-900 via-portal-800 to-slate-900 p-8 md:p-12 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-8 top-12 h-40 w-40 rounded-full bg-portal-400/20 blur-3xl" />
        <div className="absolute bottom-10 right-8 h-52 w-52 rounded-full bg-sky-400/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-portal-200">
          Zync
        </p>
        <h3 className="mt-4 text-3xl font-bold leading-tight text-white md:text-4xl">
          Everything Work,
          <br />
          <span className="bg-gradient-to-r from-portal-300 to-sky-300 bg-clip-text text-transparent">
            In One Place
          </span>
        </h3>
        <p className="mt-4 text-sm text-portal-200/90">
          Connect growth, procurement, finance, and operations in a single workflow.
        </p>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-center gap-1">
            <Users className="h-5 w-5 text-portal-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-portal-200">
              End-to-end workflow
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm ${step.tone}`}
                  >
                    <Icon className="h-4 w-4" />
                    {step.label}
                  </div>
                  {index < flowSteps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-portal-300/70" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { title: "Teams", desc: "Aligned" },
              { title: "Requests", desc: "Tracked" },
              { title: "Orders", desc: "Delivered" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-3"
              >
                <p className="text-xs font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[10px] text-portal-200">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
