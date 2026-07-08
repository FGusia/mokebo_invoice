import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";

type AppTile = {
  href: string;
  title: string;
  description: string;
  manufacturer: string;
  icon: React.ReactNode;
  available: boolean;
};

const apps: AppTile[] = [
  {
    href: "/magma/invoice-audit",
    title: "Rechnungsprüfung",
    description: "Automatisierte Audit von Herstellerrechnungen inkl. Aktionsrabatten & Stammdaten.",
    manufacturer: "Magma",
    icon: <FileText size={22} strokeWidth={2.5} />,
    available: true,
  },
];

export default function DashboardPage() {
  const manufacturers = Array.from(new Set(apps.map((a) => a.manufacturer)));

  return (
    <div className="min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 py-10 md:px-8">
        <header className="mb-10">
          <h1 className="font-black text-3xl tracking-tight">mokebo Invoice-Tools</h1>
          <p className="text-gray-400 font-medium mt-1">
            Rechnungsprüfung, gruppiert nach Hersteller
          </p>
        </header>

        {manufacturers.map((mfr) => (
          <section key={mfr} className="mb-10">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">
              {mfr}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps
                .filter((a) => a.manufacturer === mfr)
                .map((app, i) => (
                  <Link
                    key={i}
                    href={app.href}
                    aria-disabled={!app.available}
                    className={`group relative bg-white border border-gray-200/60 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all ${
                      app.available
                        ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                        : "opacity-50 cursor-not-allowed pointer-events-none"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                        {app.icon}
                      </div>
                      {app.available && (
                        <ArrowUpRight
                          size={18}
                          className="text-gray-300 group-hover:text-gray-900 transition-colors"
                        />
                      )}
                    </div>
                    <h3 className="font-black text-lg tracking-tight">{app.title}</h3>
                    <p className="text-sm text-gray-400 font-medium mt-1">
                      {app.description}
                    </p>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
