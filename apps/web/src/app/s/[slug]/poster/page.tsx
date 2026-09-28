import type { Metadata } from 'next'
import { toString as qrSvg } from 'qrcode'
import { Awning } from '@/components/awning'
import { Art, LogoMark, Wordmark } from '@/components/brand'
import { Notice } from '@/components/notice'
import { PrintButton } from '@/components/print-button'
import { kovaPublic, type PublicStall } from '@/lib/api'
import { publicUrl } from '@/lib/url'
import { chainName } from '@/lib/chain'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Table poster' }

/** An A4 poster for the stall's table: scan, order, pay. Prints edge to edge in colour. */
export default async function PosterPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  let stall: PublicStall
  try {
    stall = await kovaPublic<PublicStall>(`/v1/public/stalls/${encodeURIComponent(slug)}`)
  } catch {
    return (
      <Notice title="This stall isn’t here">
        <p>It may have closed for good.</p>
      </Notice>
    )
  }
  const url = `${await publicUrl()}/s/${stall.slug}`
  // High error correction, so the coin in the middle never stops the code scanning.
  const qr = await qrSvg(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'H', color: { dark: '#0b1a1d', light: '#ffffff' } })

  return (
    <div className="poster-page">
      <div className="poster-tools">
        <PrintButton />
        <span>A4, portrait. Tape it where people queue.</span>
      </div>
      <article className="poster">
        <Awning height={110} stripe={44} />
        <div className="poster-body">
          <h1>{stall.name}</h1>
          {stall.tagline ? <p className="poster-line">{stall.tagline}</p> : null}
          <p className="poster-ask">Scan to order and pay</p>
          <div className="poster-qr">
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: locally generated SVG */}
            <div className="poster-code" dangerouslySetInnerHTML={{ __html: qr }} />
            <span className="poster-coin" aria-hidden="true">
              <LogoMark size={46} />
            </span>
          </div>
          <p className="poster-small">No app needed. Pay in dollars with Kova Pay or any {chainName} wallet. No card fees.</p>
          <div className="poster-foot">
            <Art name="kovi-wave" size={104} />
            <div>
              <Wordmark height={26} />
              <p>{url.replace(/^https?:\/\//, '')}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
