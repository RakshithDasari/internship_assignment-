import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Downloaded at build time and served by Next itself: no runtime font requests, no layout shift.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const ICON_FONT =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block";

export const metadata = {
  title: "VisionQuest — Detect. Track. Count.",
  description: "Upload images or videos, run YOLO models, and inspect detections frame by frame.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${bebas.variable} ${mono.variable}`}>
      <head>
        {/* The icon font isn't available through next/font, so it's linked directly. */}
        <link rel="stylesheet" href={ICON_FONT} />
      </head>
      <body className="font-body antialiased selection:bg-scarlet selection:text-white">{children}</body>
    </html>
  );
}
