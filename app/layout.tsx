import type { Metadata } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Devanagari,
} from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const deva = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari"],
});

export const metadata: Metadata = {
  title: "Pakka · पक्का",
  description:
    "Udhaar you can trust. Speak a credit entry in Hindi; every amount is heard twice, checked by you, then saved and read out to the customer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${deva.variable} antialiased`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
