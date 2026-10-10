import type { Metadata, Viewport } from "next";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/public-sans/wght-italic.css";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { Footer, Masthead } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Bench Forecast",
  description: "Supreme Court vote forecasts, shown where the justices actually sit.",
};

export const viewport: Viewport = { themeColor: "#1f3d34" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Masthead />
        {children}
        <Footer />
      </body>
    </html>
  );
}
