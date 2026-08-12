import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agente de empleo",
  description: "Carga de datos, CVs a medida y seguimiento de postulaciones — local, un solo usuario.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
