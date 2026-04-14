import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PH-Intelligence — Punto Hogar",
  description: "Plataforma de Inteligencia Conversacional para Punto Hogar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} h-full bg-bg text-body`}>
        {children}
      </body>
    </html>
  );
}
