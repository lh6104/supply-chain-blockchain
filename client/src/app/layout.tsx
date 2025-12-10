import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NetworkHelper from '@/components/NetworkHelper'
import { Providers } from '@/components/Providers'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'ChainGuard | Supply Chain Manager',
  description: 'Blockchain-powered supply chain management system for tracking products from source to consumer with complete transparency',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <Providers>
          <NetworkHelper />
          {children}
        </Providers>
      </body>
    </html>
  )
}

