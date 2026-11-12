import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuroraBackground } from "@/components/glass/AuroraBackground";
import { CursorFollower } from "@/components/glass/CursorFollower";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  title: "GridMind AI — Know every unit.",
  description:
    "Your home's electricity, understood. Bill analysis, consumption forecasting, and energy waste detection in one glassy dashboard.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#6D4AFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=general-sans@400,500,600,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="font-sans text-ink antialiased selection:bg-lime selection:text-ink">
        <AuroraBackground />
        <CursorFollower />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
