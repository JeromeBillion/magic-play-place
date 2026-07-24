import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#06060e",
};

export const metadata: Metadata = {
  title: "Magic Play Place — Neuro-AI Research Lab",
  description:
    "Research-grade neuroscience platform for predicting neural-response patterns from multimodal stimuli. Supports fMRI prediction, intervention simulation, and evidence-tagged analysis.",
  keywords: ["neuroscience", "AI", "fMRI", "brain", "research", "prediction"],
  authors: [{ name: "Magic Play Place" }],
  openGraph: {
    title: "Magic Play Place — Neuro-AI Research Lab",
    description:
      "Research-grade neuroscience platform for predicting neural-response patterns from multimodal stimuli.",
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
      className={`${inter.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pt-0 m-0">{children}</body>
    </html>
  );
}
