import { headers } from "next/headers";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

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
  title: "Tuesday — Task Management",
  description: "Manage your projects and workflows",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default async function RootLayout({ children }) {
  // Set by src/proxy.js; next-themes' inline anti-flash script needs it
  // under the nonce-based CSP. Reading headers also makes every page
  // dynamic, which nonces require.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${jakartaSans.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased">
        {/* disableTransitionOnChange: per-element color transitions ran at
            different speeds and made the switch look patchy; ThemeToggle
            animates the whole page at once with a view transition instead. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
