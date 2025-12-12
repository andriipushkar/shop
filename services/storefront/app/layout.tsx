import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import { ComparisonProvider } from "@/lib/comparison-context";
import { ReviewsProvider } from "@/lib/reviews-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyShop - Інтернет-магазин",
  description: "Найкращі товари з доставкою по всій Україні. Електроніка, одяг, товари для дому та багато іншого.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <RecentlyViewedProvider>
                <ComparisonProvider>
                  <ReviewsProvider>
                    <Header />
                    <main className="flex-1">
                      {children}
                    </main>
                    <Footer />
                  </ReviewsProvider>
                </ComparisonProvider>
              </RecentlyViewedProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
