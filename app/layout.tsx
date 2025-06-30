import React from 'react'
import './globals.css'

export const metadata = {
  title: 'Knitting Socks Designer Advanced',
  description: 'Advanced web application for designing patterns and color schemes for knitting socks',
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