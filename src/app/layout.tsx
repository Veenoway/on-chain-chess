import { Header } from "@/layouts/header";
import ContextProvider from "@/lib/wagmi/provider";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Unbounded } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "react-hot-toast";
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
        {/* <Analytics /> */}
        <ContextProvider cookies={cookies}>
          <Header />
          {children}
          <Analytics />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
              success: {
                duration: 6000,
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#fff",
                },
              },
              error: {
                duration: 8000,
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
              },
              loading: {
                iconTheme: {
                  primary: "#3b82f6",
                  secondary: "#fff",
                },
              },
            }}
          />
        </ContextProvider>
      </body>
    </html>
  );
}
