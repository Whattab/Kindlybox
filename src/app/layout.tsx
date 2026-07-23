import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Caveat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant-garamond",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

// Handwriting font — used only for the personal "why it fits" note on results,
// so it reads like a handwritten card message. Chosen for legibility at small
// sizes vs. other script fonts.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "KindlyBox | The Perfect Gift Finder",
  description: "Find the perfect gift for any occasion with KindlyBox. Take our short quiz and get tailored gift recommendations instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${cormorant.variable} ${caveat.variable} bg-background font-sans text-foreground antialiased selection:bg-accent selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
