import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Agri-Edge Copilot",
  title: {
    default: "Agri-Edge Copilot",
    template: "%s · Agri-Edge",
  },
  description:
    "Offline advisory for smallholder coffee farmers: leaf diagnosis and a fair market price.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Agri-Edge",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#14532d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-emerald-50">
        <p className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-stone-950">
          Agri-Edge is an advisory tool. Always consult your cooperative for
          severe infestations.
        </p>
        {children}
      </body>
    </html>
  );
}
