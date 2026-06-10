import "./globals.css";
import QueryProvider from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "Tuesday.com — Task Management",
  description: "Manage your projects and workflows",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#F5F6F8]">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
