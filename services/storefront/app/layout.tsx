import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed-context";
import { ComparisonProvider } from "@/lib/comparison-context";
import { ReviewsProvider } from "@/lib/reviews-context";
import { LoyaltyProvider } from "@/lib/loyalty-context";
import { GiftCardProvider } from "@/lib/gift-cards-context";
import { PromoProvider } from "@/lib/promo-context";
import { I18nProvider } from "@/lib/i18n";
import { ExperimentProvider } from "@/lib/experiments";
import { ChatProvider } from "@/lib/chat/chat-context";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AppInitializer } from "@/components/AppInitializer";
import { LazyChatWidget } from "@/lib/lazy-components";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/ProductJsonLd";
import WebVitalsTracker from "@/components/WebVitalsTracker";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://techshop.ua';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "TechShop - Інтернет-магазин електроніки",
    template: "%s | TechShop",
  },
  description: "Найкращі товари з доставкою по всій Україні. Електроніка, смартфони, ноутбуки, аксесуари та багато іншого. Офіційна гарантія, швидка доставка.",
  keywords: ["інтернет-магазин", "електроніка", "смартфони", "ноутбуки", "техніка", "Україна", "доставка"],
  authors: [{ name: "TechShop" }],
  creator: "TechShop",
  publisher: "TechShop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TechShop",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    url: BASE_URL,
    siteName: "TechShop",
    title: "TechShop - Інтернет-магазин електроніки",
    description: "Найкращі товари з доставкою по всій Україні. Електроніка, смартфони, ноутбуки, аксесуари.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TechShop - Інтернет-магазин електроніки",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TechShop - Інтернет-магазин електроніки",
    description: "Найкращі товари з доставкою по всій Україні. Електроніка, смартфони, ноутбуки.",
    images: ["/og-image.png"],
    creator: "@techshop_ua",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Коди верифікації для пошукових консолей
    // Встановіть ці змінні в .env.local або .env.production
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION || "",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <head>
        {/* DNS prefetch for external resources to improve performance */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Preload critical CSS for faster rendering */}
        <link
          rel="preload"
          href="/fonts/geist-sans.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        {/* Structured Data for SEO */}
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-teal-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none"
        >
          Перейти до основного вмісту
        </a>
        <I18nProvider>
          <ExperimentProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <RecentlyViewedProvider>
                    <ComparisonProvider>
                      <ReviewsProvider>
                        <LoyaltyProvider>
                          <GiftCardProvider>
                            <PromoProvider>
                              <ChatProvider>
                                <AppInitializer />
                                <WebVitalsTracker />
                                <PWARegister />
                                <InstallPrompt />
                                <OfflineIndicator />
                                <Header />
                                <main id="main-content" className="flex-1">
                                  {children}
                                </main>
                                <Footer />
                                <LazyChatWidget />
                              </ChatProvider>
                            </PromoProvider>
                          </GiftCardProvider>
                        </LoyaltyProvider>
                      </ReviewsProvider>
                    </ComparisonProvider>
                  </RecentlyViewedProvider>
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </ExperimentProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
