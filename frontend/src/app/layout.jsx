import { Bebas_Neue, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Header from "@/components/Header";
import IntroBackdrop from "@/components/IntroBackdrop";
import "./globals.css";

// Downloaded at build time and served by Next itself: no runtime font requests, no layout shift.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const ICON_FONT =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block";

export const metadata = {
  title: "VisionQuest — Detect. Track. Count.",
  description: "Upload images or videos, run YOLO models, and inspect detections frame by frame.",
};

// Runs before first paint so a saved light theme doesn't flash dark on load.
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch{}`;

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT may set data-theme before React hydrates.
    <html lang="en" className={`${sans.variable} ${bebas.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* The icon font isn't available through next/font, so it's linked directly. */}
        <link rel="stylesheet" href={ICON_FONT} />
      </head>
      {/* Backdrop and nav live here, not in each page, so they persist across navigation (the nav pill can slide). */}
      <body className="flex min-h-screen flex-col font-body antialiased selection:bg-scarlet selection:text-white">
        <IntroBackdrop />
        <Header />
        {children}
      </body>
    </html>
  );
}
