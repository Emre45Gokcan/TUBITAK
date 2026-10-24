import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// latin-ext covers Turkish letters (ç, ğ, ı, İ, ö, ş, ü).
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const appName = process.env.APP_NAME ?? "Sınıf Platformu";

export const metadata: Metadata = {
  title: { default: appName, template: `%s | ${appName}` },
  description: "Öğretmenler sınıf oluşturur, öğrenciler katılım koduyla sınıflara katılır.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
