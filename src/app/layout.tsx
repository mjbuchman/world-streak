import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { AccountHeader } from "@/components/AccountHeader";
import { AdSenseScript } from "@/components/AdSlot";
import { HydrationMarker } from "@/components/HydrationMarker";
import { SiteFooter } from "@/components/SiteFooter";
import { GAME_NAME, GAME_PITCH } from "@/config/game";
import "./tokens.css";
import "./globals.css";

// Fresh Sport type (docs/UI_GUIDELINES.md): Unbounded for display, Manrope for everything else.
const displayFont = Unbounded({ variable: "--fs-typeface-display", subsets: ["latin"] });
const bodyFont = Manrope({ variable: "--fs-typeface-body", subsets: ["latin"] });

export const metadata: Metadata = {
  // Pages set only their own part, for example "Sign in" becomes "Sign in | World Streak".
  title: { default: GAME_NAME, template: `%s | ${GAME_NAME}` },
  description: GAME_PITCH,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <HydrationMarker />
        <AccountHeader />
        {children}
        <SiteFooter />
        <AdSenseScript />
      </body>
    </html>
  );
}
