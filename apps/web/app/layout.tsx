import type { Metadata } from "next";
import { Anton, Archivo, IBM_Plex_Mono } from "next/font/google";

import { ThemeScript } from "@/components/shared/theme-script";
import { site } from "@/config/site";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-heading",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

/**
 * The navbar wordmark, and nothing else. Loaded under its own variable name
 * rather than folded into `--font-heading`: the token it feeds is named for the
 * one place it is allowed to appear, so a stray `font-wordmark` elsewhere is
 * visible in review as the mistake it is.
 *
 * Single weight, hence the explicit `400`.
 */
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} ${anton.variable} scrollbar-sleek`}
      // Pairs with `scroll-behavior: smooth` in globals.css. Without it Next.js
      // has no way to tell that a smooth reset is unintended, so a route change
      // animates against a mid-transition page height; with it, Next.js forces
      // `scroll-behavior: auto` for the length of the transition and leaves the
      // animation to anchor jumps, which is where it was wanted.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
