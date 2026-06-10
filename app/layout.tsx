import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeRead Skills Web",
  description: "A simple web client for WeRead Skills APIs."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
