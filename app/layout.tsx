import './globals.css'
import type { Metadata } from 'next'
import { AppProvider } from '@/context/AppContext'

export const metadata: Metadata = {
  title: 'Dhurdur | Barbershop Schweinfurt',
  description: 'Dhurdur Barbershop in Schweinfurt — Haarschnitt, Fade, Bart & Rasur. Jetzt online Termin buchen.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="scroll-smooth">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}