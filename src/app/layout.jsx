import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata = {
  title: "Tuesday.com — Task Management",
  description: "Manage your projects and workflows",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
