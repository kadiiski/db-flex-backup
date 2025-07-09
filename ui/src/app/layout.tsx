import type { Metadata } from "next";
import "./globals.css";
import { Roboto } from "next/font/google";
import { Toaster } from "sonner";

const pageTitle = process.env.NEXT_PUBLIC_BACKUPS_UI_TITLE || "Database Backups";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: pageTitle,
  description: 'UI for managing database backups',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${roboto.className} bg-gray-950 text-white`}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
        />
      </body>
    </html>
  );
}
