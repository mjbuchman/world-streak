import type { Metadata } from "next";
import { Bricolage_Grotesque, Roboto_Flex } from "next/font/google";
import { GAME_NAME } from "@/lib/config";
import "./tokens.css";
import "./globals.css";

const plainFont = Roboto_Flex({ variable: "--md-ref-typeface-plain", subsets: ["latin"] });
const brandFont = Bricolage_Grotesque({ variable: "--md-ref-typeface-brand", subsets: ["latin"] });

export const metadata: Metadata = {
  title: GAME_NAME,
  description: "One daily challenge. If enough of the world passes, the streak survives.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plainFont.variable} ${brandFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
