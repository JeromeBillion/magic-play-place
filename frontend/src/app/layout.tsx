import type { Metadata, Viewport } from "next";
import { Caprasimo, Figtree } from "next/font/google";
import "./globals.css";

/** Caprasimo is the only display voice in the Organic system. */
const caprasimo = Caprasimo({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-caprasimo",
});

/** Figtree carries every piece of body copy and interface text. */
const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-figtree",
});

export const viewport: Viewport = {
  themeColor: "#f5ead8",
};

export const metadata: Metadata = {
  title: "Magic Play Place",
  description:
    "Show a model a sentence, a picture, a clip or a sound, and see how a brain might respond — with every finding labelled by how much to trust it. Research use only, never medical advice.",
  keywords: ["neuroscience", "AI", "fMRI", "brain", "research", "prediction"],
  authors: [{ name: "Magic Play Place" }],
  // The browser icon comes from app/favicon.ico — a transparent, multi-size
  // build. Don't override it here with a single large PNG.
  openGraph: {
    title: "Magic Play Place",
    description:
      "Show a model a sentence, a picture, a clip or a sound, and see how a brain might respond — every finding labelled by how much to trust it.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${caprasimo.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="m-0 flex min-h-full flex-col">{children}</body>
    </html>
  );
}
