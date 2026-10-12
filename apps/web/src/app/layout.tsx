import type { Metadata, Viewport } from 'next'
import { chainName, onTempo } from '@/lib/chain'
import './globals.css'
import '../styles/app.css'
import '../styles/auth.css'
import '../styles/landing.css'
import '../styles/stalls.css'
import '../styles/wallet.css'

const DESCRIPTION = `Your dollars, anywhere, in seconds. A wallet that opens with a passkey, with your shop inside it. On ${chainName}.`

/** Where this site lives, for absolute preview-card links: PUBLIC_URL, else each chain's address. */
const SITE =
  process.env.PUBLIC_URL ??
  (onTempo ? 'https://web-production-acdb.up.railway.app' : 'https://mykova.app')

/** The preview card (app/opengraph-image.png): Reni flying a paper plane from a shop, on Ren's mint. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Ren', template: '%s · Ren' },
  description: DESCRIPTION,
  openGraph: {
    siteName: 'Ren',
    type: 'website',
    title: 'Ren · Tap. Paid. Anywhere.',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ren · Tap. Paid. Anywhere.',
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E8F7EF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
