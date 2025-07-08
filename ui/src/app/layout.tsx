import type { Metadata } from "next";
import "./globals.css";
import { Roboto } from "next/font/google";
import { Toaster } from "sonner";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Backup",
  description: "Backup",
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
