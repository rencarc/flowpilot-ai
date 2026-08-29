import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowPilot AI",
  description: "AI intake, risk control, human review, and workflow handoff for internal operations.",
  icons: {
    icon: "/flowpilot-favicon.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
