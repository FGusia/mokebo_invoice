import Link from "next/link";
import { ArrowUpRight, Truck } from "lucide-react";
import { MokeboMark, MokeboWordmark } from "@/components/MokeboLogo";
import { MagmaMark } from "@/components/magma/MagmaLogo";
import { ProcontourMark } from "@/components/procontour/ProcontourLogo";
import { BrilliantMark } from "@/components/brilliant/BrilliantLogo";

type AppTile = {
  href: string;
  title: string;
  description: string;
  group: string;
  icon: React.ReactNode;
  available: boolean;
};

const herstellerApps: AppTile[] = [
  {
    href: "/magma/invoice-audit",
    title: "Rechnungsprüfung",
    description: "Automatisierte Audit von Herstellerrechnungen inkl. Aktionsrabatten & Stammdaten.",
    group: "Magma",
    icon: <MagmaMark size={48} />,
    available: true,
  },
  {
    href: "/procontour/invoice-audit",
    title: "Rechnungsprüfung",
    description: "Rechnungsprüfung & Preisabgleich mit Stammdaten.",
    group: "Procontour",
    icon: <ProcontourMark height={40} />,
    available: true,
  },
  {
    href: "/brilliant/invoice-audit",
    title: "Rechnungsprüfung",
    description: "Automatisierte Audit von Herstellerrechnungen inkl. Aktionsrabatten & Stammdaten.",
    group: "Brilliant",
    icon: <BrilliantMark height={40} />,
    available: true,
  },
];

const logistikApps: AppTile[] = [
  {
    href: "#",
    title: "Sperrgut-Check",
    description: "Automatische Prüfung auf Sperrgut-Versand – folgt in Kürze.",
    group: "DHL",
    icon: <Truck size={22} strokeWidth={2.5} />,
    available: false,
  },
  {
    href: "#",
    title: "Sperrgut-Check",
    description: "Automatische Prüfung auf Sperrgut-Versand – folgt in Kürze.",
    group: "GLS",
    icon: <Truck size={22} strokeWidth={2.5} />,
    available: false,
  },
];

function AppGrid({ apps }: { apps: AppTile[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {apps.map((app, i) => (
        <Link
          key={i}
          href={app.href}
          aria-disabled={!app.available}
          className={`group relative bg-mokebo-surface border border-mokebo-border rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.25)] transition-all ${
            app.available
              ? "hover:shadow-lg hover:-translate-y-0.5 hover:border-mokebo-mint/50 cursor-pointer"
              : "opacity-50 cursor-not-allowed pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center">{app.icon}</div>
            {app.available && (
              <ArrowUpRight
                size={18}
                className="text-mokebo-muted group-hover:text-mokebo-mint transition-colors"
              />
            )}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-mokebo-muted mb-1">
            {app.group}
          </div>
          <h3 className="font-black text-lg tracking-tight text-mokebo-fg">{app.title}</h3>
          <p className="text-sm text-mokebo-muted font-medium mt-1">{app.description}</p>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-mokebo-dark">
      <div className="max-w-screen-xl mx-auto px-4 py-10 md:px-8">
        <header className="mb-12 flex items-center gap-4">
          <MokeboMark size={48} />
          <div>
            <h1 className="flex items-baseline gap-2 text-3xl">
              <MokeboWordmark className="text-mokebo-fg" />
              <span className="font-sans font-semibold text-mokebo-muted text-xl">
                Invoice-Tools
              </span>
            </h1>
            <p className="text-mokebo-muted font-medium mt-1">
              Rechnungsprüfung, gruppiert nach Hersteller
            </p>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-mokebo-muted mb-4">
            Hersteller
          </h2>
          <AppGrid apps={herstellerApps} />
        </section>

        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-mokebo-muted mb-4">
            Logistikdienstleister
          </h2>
          <AppGrid apps={logistikApps} />
        </section>
      </div>
    </div>
  );
}
