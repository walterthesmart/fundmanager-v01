import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/sonner"
import { DisplayCurrencyProvider } from "@/lib/display-currency"
import "./globals.css"
import Providers from "./providers"

export const metadata: Metadata = {
  title: 'Sankore Fund Manager',
  description: 'Sankore Fund Manager — real-time balances, immutable audit trails and verified account transactions.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" />
      </head>
      <body>
        <Providers>
          <DisplayCurrencyProvider>
            {children}
            <Toaster position="top-right" />
          </DisplayCurrencyProvider>
        </Providers>
      </body>
    </html>
  )
}
