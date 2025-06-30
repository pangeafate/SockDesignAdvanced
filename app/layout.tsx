import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Knitting Socks Designer',
  description: 'Design patterns and colors for your knitting socks',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} 