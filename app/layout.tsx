import type { Metadata } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Devanagari,
} from "next/font/google";
import { LangSync } from "@/components/LangToggle";
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

const description =
  "Udhaar you can trust. Speak a credit entry in Hindi; every amount is heard twice, checked by you, then saved and read out to the customer.";

export const metadata: Metadata = {
  metadataBase: new URL("https://pakka-nu-puce.vercel.app"),
  title: "Pakka · पक्का",
  description,
  openGraph: { title: "Pakka · पक्का", description, type: "website", locale: "hi_IN" },
};

// The page is built ahead of time in English. When the visitor chose Hindi,
// hide the page until React has switched the text, so English never flashes.
// The 2.5 s fallback shows the page even if the app script fails to load.
const LANG_BOOT = `try{var l=localStorage.getItem("pakka-lang");if(l!=="en"&&(l==="hi"||(navigator.language||"").toLowerCase().indexOf("hi")===0)){var d=document.documentElement;d.lang="hi";d.classList.add("lang-pending");setTimeout(function(){d.classList.remove("lang-pending")},2500)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${deva.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT }} />
      </head>
      <body className="min-h-screen">
        <LangSync />
        {children}
      </body>
    </html>
  );
}
