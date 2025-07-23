import { Header } from "@/layouts/header";
import ContextProvider from "@/lib/wagmi/provider";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Unbounded } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const poppins = Unbounded({
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chess Room | Play Chess On Chain",
  description: "Play Chess Online with your friends.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookies = (await headers()).get("cookie");
  return (
    <html lang="en-US">
      <body className={poppins.className}>
        <ContextProvider cookies={cookies}>
          <Header />
          {children}
          <Analytics />
        </ContextProvider>
      </body>
    </html>
  );
}
