import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bench Forecast",
  description: "Supreme Court vote forecasts, shown where the justices actually sit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
