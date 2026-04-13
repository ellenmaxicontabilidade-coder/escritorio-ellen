import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Escritório Ellen Maximiano',
  description: 'Sistema de gestão contábil e previdenciário',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
