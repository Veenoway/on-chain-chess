import { Header } from "@/layouts/header";
import ContextProvider from "@/lib/wagmi/provider";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-beba",
  subsets: ["latin"],
  weight: "400",
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
        {/* <Analytics /> */}
        <ContextProvider cookies={cookies}>
          <Header />
          {children}
        </ContextProvider>
      </body>
    </html>
  );
}
