import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse | Gym Growth OS",
  description: "Daily gym operations, from one focused workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
