import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { QueryProvider } from '@/lib/query-provider'
import { AuthProvider } from '@/lib/auth-context'
import { Sidebar } from '@/components/layout/Sidebar'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Admin Panel - Shop',
  description: 'Shop Administration Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <div className="flex h-screen bg-gray-100">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
            <Toaster position="top-right" />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
