import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mokebo Invoice-Tools",
  description: "Rechnungsprüfung für alle Hersteller",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
