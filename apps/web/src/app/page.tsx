import type { Metadata, Viewport } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { HomeMotion } from '@/components/home-motion'
import { I, Screen, SiteFooter, SiteNav, SiteSprite } from '@/components/site'
import { chainName, onTempo } from '@/lib/chain'
import { getSession } from '@/lib/session'
import { zoneSite } from '@/lib/zone-site'
import { signInDemo } from './actions'
import '../styles/home.css'

export const metadata: Metadata = {
  title: { absolute: 'Ren · Your dollars, your rules' },
  description: `A dollar wallet that opens with Face ID. Pay a shop in about a second, and give a card, a person or an AI agent a key with its own limit. On ${chainName}.`,
}

/** The home page is black, so the browser's bar is too. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

/** The currencies the wallet can show a balance in (the wallet's "Show my money in"). */
const MONEY = [
  ['$', 'US dollars', 'Dollars, just as they are'],
  ['€', 'Euros', 'Every amount in euros'],
  ['£', 'British pounds', 'Every amount in pounds'],
  ['₦', 'Naira', 'Every amount in naira'],
  ['KSh', 'Kenyan shillings', 'Every amount in shillings'],
  ['MX$', 'Mexican pesos', 'Every amount in pesos'],
] as const

/** The ways money moves through Ren today. */
const WAYS = [
  ['scan', 'Scan a code', 'At the counter'],
  ['tap', 'Tap', 'Phone to phone'],
  ['link', 'Pay link', 'Opens in the wallet'],
  ['store', 'Table code', 'At a stall'],
  ['send', 'Send', 'By link or address'],
  ['down', 'Request', 'Ask for an exact amount'],
  ['bolt', 'AI agent', 'Over MCP, within its limit'],
  ['code', 'Machine payment', 'Over MPP'],
] as const

/** The developer section's three examples, already coloured. */
const CODE = [
  '<span class="m">$</span> curl <span class="s">$REN_API/v1/payment_intents</span> \\\n    -H <span class="s">"Authorization: Bearer $REN_SECRET_KEY"</span> \\\n    -H <span class="s">"Idempotency-Key: order-1042"</span> \\\n    -d <span class="s">\'{"amount":"12.50","reference":"Order 1042"}\'</span>\n\n{\n  <span class="k">"id"</span>: <span class="s">"pi_06gd1ajtn5yr71g1tdwpvk9fqm"</span>,\n  <span class="k">"amount"</span>: <span class="s">"12.50"</span>,\n  <span class="k">"status"</span>: <span class="s">"requires_payment"</span>\n}',
  '<span class="m">// About a second later, signed, to your endpoint</span>\n{\n  <span class="k">"type"</span>: <span class="g">"payment_intent.paid"</span>,\n  <span class="k">"data"</span>: {\n    <span class="k">"id"</span>: <span class="s">"pi_06gd1ajtn5yr71g1tdwpvk9fqm"</span>,\n    <span class="k">"amount"</span>: <span class="s">"12.50"</span>,\n    <span class="k">"reference"</span>: <span class="s">"Order 1042"</span>\n  }\n}',
  '<span class="m"># Make an agent key in the wallet, with a daily limit,</span>\n<span class="m"># then add Ren\'s MCP server with the key\'s token</span>\n<span class="m">$</span> claude mcp add --transport http ren <span class="s">$REN_API/mcp</span> \\\n    --header <span class="s">"Authorization: Bearer $REN_AGENT_TOKEN"</span>\n\n<span class="m"># The agent can now pay, within its limit</span>\n<span class="k">ren_pay</span> · <span class="k">ren_pay_charge</span>',
] as const

/** A floating piece of the hero's art: where it sits, how it leans, how it drifts. */
function Float({
  src,
  box,
  drift,
  className,
}: {
  src: string
  box: CSSProperties & { '--r'?: string }
  drift?: CSSProperties & { '--t'?: string; '--dl'?: string }
  className?: string
}) {
  return (
    <div className={className ? `a ${className}` : 'a'} style={box}>
      {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art, no optimizer needed */}
      <img src={`/art/${src}.webp`} alt="" style={drift} />
    </div>
  )
}

/** A line with a tick, in a feature's short list. */
function Check({ children }: { children: ReactNode }) {
  return (
    <li>
      <span className="ck">
        <I id="check" />
      </span>
      {children}
    </li>
  )
}

/** One question and its answer. */
function Qa({ q, open, children }: { q: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="qa" open={open}>
      <summary>
        {q}
        <span className="pm">
          <I id="plus" />
        </span>
      </summary>
      <p>{children}</p>
    </details>
  )
}

export default async function Home() {
  const signedIn = Boolean(await getSession())
  // Live on mainnet is Ren on Monad's claim; a Tempo build is on Tempo's test network.
  const mainnet = !onTempo && process.env.KOVA_NETWORK === 'mainnet'
  const login = signedIn ? 'Open Ren' : 'Log in'
  const dollar = onTempo ? 'OUSD' : 'AUSD'
  const zone = zoneSite()
  return (
    <div className="rn" id="rn">
      <SiteSprite />

      <SiteNav login={login} />

      <main id="top">
        {/* Hero -------------------------------------------------------------------------- */}
        <section className="hero" id="hero">
          <div className="art art-desk" aria-hidden="true">
            <Float
              src="coin-usd"
              box={{ width: 118, left: '5%', top: 150, '--r': '-14deg', transitionDelay: '.05s' }}
              drift={{ '--t': '8s' }}
            />
            <Float
              src="reni-wave"
              box={{ width: 250, left: '9%', top: 262, '--r': '-6deg', transitionDelay: '.15s' }}
              drift={{ '--t': '7s', '--dl': '-2s' }}
            />
            <Float
              src="plane"
              box={{ width: 130, left: '21%', top: 140, '--r': '8deg', transitionDelay: '.25s' }}
              drift={{ '--t': '10s', '--dl': '-4s' }}
            />
            <Float
              src="avatar-5"
              box={{ width: 78, left: '2.5%', top: 470, '--r': '10deg', transitionDelay: '.3s' }}
              drift={{ '--t': '9s', '--dl': '-1s' }}
            />
            <Float
              src="coin-gbp"
              box={{ width: 84, left: '23%', top: 470, '--r': '-10deg', transitionDelay: '.35s' }}
              drift={{ '--t': '8.5s', '--dl': '-3s' }}
            />
            <Float
              src="sparkle-8"
              box={{ width: 30, left: '17%', top: 230, transitionDelay: '.4s' }}
            />
            <Float
              src="sparkle-11"
              box={{ width: 24, left: '3%', top: 330, transitionDelay: '.45s' }}
            />
            <Float
              src="sparkle-4"
              box={{ width: 22, left: '27%', top: 380, transitionDelay: '.5s' }}
            />

            <Float
              className="card-art"
              src="card-active"
              box={{ width: 290, right: '5%', top: 205, '--r': '14deg', transitionDelay: '.1s' }}
              drift={{ '--t': '9s', '--dl': '-1s' }}
            />
            <Float
              src="coin-eur"
              box={{ width: 96, right: '24%', top: 104, '--r': '12deg', transitionDelay: '.2s' }}
              drift={{ '--t': '8s', '--dl': '-3s' }}
            />
            <Float
              src="coin-ngn"
              box={{ width: 92, right: '3%', top: 112, '--r': '-8deg', transitionDelay: '.28s' }}
              drift={{ '--t': '9.5s', '--dl': '-5s' }}
            />
            <Float
              src="reni-key"
              box={{ width: 176, right: '18%', top: 400, '--r': '6deg', transitionDelay: '.34s' }}
              drift={{ '--t': '7.5s', '--dl': '-2s' }}
            />
            <Float
              src="avatar-2"
              box={{ width: 76, right: '4%', top: 470, '--r': '-6deg', transitionDelay: '.4s' }}
              drift={{ '--t': '8s', '--dl': '-4s' }}
            />
            <Float
              src="sparkle-8"
              box={{ width: 28, right: '27%', top: 330, transitionDelay: '.45s' }}
            />
            <Float
              src="sparkle-11"
              box={{ width: 24, right: '30%', top: 200, transitionDelay: '.5s' }}
            />
            <Float
              src="sparkle-4"
              box={{ width: 22, right: '2%', top: 390, transitionDelay: '.55s' }}
            />
          </div>

          <div className="hero-copy">
            <div className="art-mob" aria-hidden="true">
              <Float
                src="coin-usd"
                box={{ width: 60, left: '2%', top: 46, '--r': '-14deg' }}
                drift={{ '--t': '8s' }}
              />
              <Float
                src="coin-eur"
                box={{ width: 40, left: '21%', top: 2, '--r': '12deg' }}
                drift={{ '--t': '9s', '--dl': '-3s' }}
              />
              <Float
                src="reni-wave"
                box={{ width: 132, left: '50%', marginLeft: -66, top: -4 }}
                drift={{ '--t': '7s' }}
              />
              <Float
                className="card-art"
                src="card-active"
                box={{ width: 112, right: '1%', top: 36, '--r': '14deg' }}
                drift={{ '--t': '9s', '--dl': '-2s' }}
              />
              <Float src="sparkle-8" box={{ width: 18, right: '30%', top: 8 }} />
              <Float src="sparkle-11" box={{ width: 14, left: '30%', top: 104 }} />
            </div>
            <a className="news" href="#faq">
              <span className="n">{mainnet ? 'Live' : 'Testnet'}</span>
              <span>
                {mainnet ? `Ren is live on ${chainName}` : `On ${chainName}’s test network`}
                {mainnet ? null : <span className="wide">, with test dollars</span>}
              </span>
              <I id="arrow" />
            </a>
            <h1>
              Your dollars,
              <br />
              your rules.
            </h1>
            <p className="lede">
              Ren is a dollar wallet that opens with Face ID. Pay a shop in about a second, and give
              a card, a person or an AI agent a key with its own limit.
            </p>
            <div className="ctas">
              <a className="btn b-coral" href="/wallet">
                Open Ren on the web{' '}
                <span className="o">
                  <I id="arrow" />
                </span>
              </a>
              <a className="btn b-soft" href="/wallet/shop?go=open">
                Open a shop
              </a>
            </div>
          </div>

          <div className="stage">
            <div className="stage-in" id="stageIn">
              <div className="kdev l">
                <Screen
                  src="keys-list"
                  alt="Your keys: your passkey, Claude with $20.00 a day, Sam with $30.00 a week"
                  eager
                />
              </div>
              <div className="kdev c">
                <Screen
                  src="home"
                  alt="Ren’s home screen: $19.25 available, with Pay, Send and Request"
                  eager
                />
              </div>
              <div className="kdev r">
                <Screen
                  src="activity"
                  alt="Activity: $19.25 in this month, with each payment as it arrived"
                  eager
                />
              </div>
              <div className="stage-tag t1">
                {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                <img src="/art/avatar-2.webp" alt="" />
                <span>
                  Sam’s allowance<small>$30.00 a week, from your dollars</small>
                </span>
              </div>
              <div className="stage-tag t2">
                {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                <img src="/art/badge-shop.webp" alt="" />
                <span>
                  4 sales at Mia’s Bakery<small>$12.25 today, no card fees</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Keys: Ren's main idea ------------------------------------------------------------ */}
        <section className="sec" id="keys">
          <div className="wrap split">
            <div className="s-copy">
              <span className="ktag rv">Keys with limits</span>
              <h2 className="rv d1">Give out a key, not your wallet.</h2>
              <p className="lede rv d2">
                A Ren Card, a family member’s allowance, an AI agent: each one spends with its own
                key. You set the limit, and {chainName} enforces it.
              </p>
              <ul className="checks rv d3">
                <Check>A limit for each day or each week</Check>
                <Check>An end date on every key</Check>
                <Check>Freeze any key with one switch</Check>
              </ul>
            </div>
            <div className="s-visual rv d1" data-par>
              <div className="ph">
                <Screen
                  src="keys-list"
                  alt="Keys in Ren: New agent key, Give an allowance, and your keys with what each has left"
                />
              </div>
              {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
              <img className="card-float" src="/art/card-active.webp" alt="" loading="lazy" />
            </div>
          </div>
        </section>

        {/* Pay ----------------------------------------------------------------------------- */}
        <section className="sec teal" id="pay" style={{ paddingTop: 0 }}>
          <div className="wrap split rev">
            <div className="s-copy">
              <span className="ktag rv">Pay</span>
              <h2 className="rv d1">Pay a shop in about a second.</h2>
              <p className="lede rv d2">
                Tap, or scan the shop’s code, and say yes with Face ID. The shop has the money
                before you’ve put your phone away.
              </p>
              <ul className="checks rv d3">
                <Check>No card fees, for you or the shop</Check>
                <Check>Ren covers the network fee</Check>
                <Check>A receipt the moment it lands</Check>
              </ul>
            </div>
            <div className="s-visual rv d1" data-par>
              <div className="ph">
                <Screen
                  src="paid-receipt"
                  alt="Paid! $3.50 to Mia’s Bakery. It took 2.4 seconds and the fee was $0.00"
                />
              </div>
              {(
                [
                  ['o1', 'coin-usd', '0s'],
                  ['o2', 'badge-shop', '-2s'],
                  ['o3', 'coin-gbp', '-4s'],
                  ['o4', 'coin-eur', '-1s'],
                  ['o5', 'coin-ngn', '-3s'],
                  ['o6', 'avatar-5', '-5s'],
                ] as const
              ).map(([spot, art, delay]) => (
                <span className={`orbit ${spot}`} key={spot}>
                  <i style={{ animationDelay: delay }}>
                    {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                    <img src={`/art/${art}.webp`} alt="" loading="lazy" />
                  </i>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* The rest, as a carousel -------------------------------------------------------- */}
        <section className="sec" id="more" style={{ paddingTop: 0 }}>
          <div className="wrap gal-head">
            <div>
              <span className="ktag rv">Get to know Ren</span>
              <h2 className="rv d1">One wallet. Every way you move money.</h2>
            </div>
          </div>
          <div className="rail" id="rail">
            <article
              className="gc"
              data-g="allowance"
              style={
                {
                  '--c': 'linear-gradient(165deg,#C2185B 0%,#7D0F3B 100%)',
                  '--c-solid': '#7D0F3B',
                } as CSSProperties
              }
            >
              <div className="gc-txt">
                <span className="eb">
                  <I id="users" />
                  Allowances
                </span>
                <h3>Give someone an allowance, not your wallet.</h3>
              </div>
              <div className="vis">
                <div className="ph">
                  <Screen
                    src="key-detail"
                    alt="Sam’s allowance: $30.00 left of $30.00 this week, with Freeze this key"
                  />
                </div>
                <span className="stk" style={{ width: 30, right: 52, top: 40 }}>
                  {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                  <img src="/art/sparkle-8.webp" alt="" />
                </span>
              </div>
              <button type="button" className="plus" aria-label="More about allowances">
                <I id="plus" />
              </button>
            </article>

            <article
              className="gc ink"
              data-g="agent"
              style={
                {
                  '--c': 'linear-gradient(165deg,#2E1620 0%,#141112 100%)',
                  '--c-solid': '#141112',
                } as CSSProperties
              }
            >
              <div className="gc-txt">
                <span className="eb">
                  <I id="bolt" />
                  AI agents
                </span>
                <h3>Give an AI agent a budget.</h3>
              </div>
              <div className="vis">
                <div className="ph">
                  <Screen
                    src="agent-detail"
                    alt="Claude’s key: $20.00 a day, $5.00 at most per payment, asks you above $1.00"
                  />
                </div>
                <span
                  className="stk"
                  style={{ width: 92, right: 14, top: -34, animationDelay: '-1s' }}
                >
                  {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                  <img src="/art/reni-key.webp" alt="" />
                </span>
              </div>
              <button type="button" className="plus" aria-label="More about AI agents">
                <I id="plus" />
              </button>
            </article>

            <article
              className="gc light"
              data-g="send"
              style={
                {
                  '--c': 'linear-gradient(165deg,#FF8FA6 0%,#FF6F8C 100%)',
                  '--c-solid': '#FF6F8C',
                } as CSSProperties
              }
            >
              <div className="gc-txt">
                <span className="eb">
                  <I id="send" />
                  Send
                </span>
                <h3>Send to a friend in about a second.</h3>
              </div>
              <div className="vis">
                <div className="ph">
                  <Screen
                    src="send-receipt"
                    alt="Receipt: $2.00 sent to Mia for lunch. It took 1.5 seconds, fee $0.00"
                  />
                </div>
                <span
                  className="stk"
                  style={{ width: 130, right: 6, top: 2, animationDelay: '-3s' }}
                >
                  {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                  <img src="/art/plane.webp" alt="" />
                </span>
              </div>
              <button type="button" className="plus" aria-label="More about sending">
                <I id="plus" />
              </button>
            </article>

            <article
              className="gc light"
              data-g="receive"
              style={
                {
                  '--c': 'linear-gradient(165deg,#FBE9EC 0%,#F3CFD6 100%)',
                  '--c-solid': '#F3CFD6',
                } as CSSProperties
              }
            >
              <div className="gc-txt">
                <span className="eb">
                  <I id="scan" />
                  Get paid
                </span>
                <h3>One code. Anyone with Ren can pay it.</h3>
              </div>
              <div className="vis">
                <div className="ph">
                  <Screen src="receive" alt="Get paid: scan to pay Mia, with her code and link" />
                </div>
                <span
                  className="stk"
                  style={{ width: 68, left: 30, top: -26, animationDelay: '-2s' }}
                >
                  {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                  <img src="/art/coin-usd.webp" alt="" />
                </span>
              </div>
              <button type="button" className="plus" aria-label="More about getting paid">
                <I id="plus" />
              </button>
            </article>

            {zone ? (
              <article
                className="gc ink"
                data-g="private"
                style={
                  {
                    '--c': 'linear-gradient(165deg,#3A0F24 0%,#1B0A12 100%)',
                    '--c-solid': '#1B0A12',
                  } as CSSProperties
                }
              >
                <div className="gc-txt">
                  <span className="eb">
                    <I id="lock" />
                    Private balance
                  </span>
                  <h3>A balance strangers can’t look up.</h3>
                </div>
                <div className="vis">
                  <div className="ph">
                    <Screen
                      src="private-in"
                      alt="Private balance: move dollars in from your balance, $19.25 available"
                    />
                  </div>
                  <span className="stk" style={{ width: 28, right: 46, top: 36 }}>
                    {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                    <img src="/art/sparkle-11.webp" alt="" />
                  </span>
                </div>
                <button type="button" className="plus" aria-label="More about the private balance">
                  <I id="plus" />
                </button>
              </article>
            ) : null}
          </div>
          <div className="wrap gal-foot">
            <div className="prog" aria-hidden="true">
              <i id="progBar"></i>
            </div>
            <div className="arrows">
              <button type="button" className="arr" id="prev" aria-label="Back">
                <I id="left" />
              </button>
              <button type="button" className="arr" id="next" aria-label="More">
                <I id="arrow" />
              </button>
            </div>
          </div>
          <dialog className="gd" id="gd" aria-labelledby="gdTitle">
            <div className="gd-in">
              <button type="button" className="gd-x" id="gdX" aria-label="Close">
                <I id="x" />
              </button>
              <span className="eb" id="gdEb"></span>
              <h3 id="gdTitle">Details</h3>
              <ul className="gd-pts" id="gdPts"></ul>
              <p className="gd-note" id="gdNote"></p>
            </div>
          </dialog>
        </section>

        {/* Your money, your way ------------------------------------------------------------ */}
        <section className="sec" id="places" style={{ paddingTop: 20 }}>
          <div className="wrap center">
            <span className="ktag rv">Yours to read</span>
            <h2 className="rv d1">Dollars, shown in your own money.</h2>
            <p className="lede rv d2">
              Ren holds dollars. Pick the currency you think in, and every balance and price shows
              in it.
            </p>
            <div className="tabs rv d3" role="tablist">
              <button
                type="button"
                className="tab"
                role="tab"
                aria-selected="true"
                data-pane="money"
              >
                Show it in
              </button>
              <button
                type="button"
                className="tab"
                role="tab"
                aria-selected="false"
                data-pane="ways"
              >
                Ways to pay
              </button>
            </div>
            <div className="places p3" id="money">
              {MONEY.map(([sign, name, how], i) => (
                <div className="pc" key={name} style={{ '--i': i } as CSSProperties}>
                  <span className="lg sym">{sign}</span>
                  <span>
                    {name}
                    <small>{how}</small>
                  </span>
                </div>
              ))}
            </div>
            <div className="places p4" id="ways" hidden>
              {WAYS.map(([icon, name, how], i) => (
                <div className="pc" key={name} style={{ '--i': i } as CSSProperties}>
                  <span className="lg sym">
                    <I id={icon} />
                  </span>
                  <span>
                    {name}
                    <small>{how}</small>
                  </span>
                </div>
              ))}
            </div>
            <p className="places-note" id="placesNote">
              Shown at Ren’s reference rates. Payments always settle in dollars.
            </p>
          </div>
        </section>

        {/* Security -------------------------------------------------------------------------- */}
        <section className="sec" id="security" style={{ paddingTop: 40 }}>
          <div className="wrap secu">
            <div className="secu-art rv">
              <span className="ring" style={{ width: 440, height: 440 }}></span>
              <span
                className="ring"
                style={{
                  width: 330,
                  height: 330,
                  animationDirection: 'reverse',
                  animationDuration: '80s',
                }}
              ></span>
              {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
              <img
                className="spk"
                src="/art/sparkle-8.webp"
                alt=""
                style={{ left: '18%', top: '20%' }}
              />
              {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
              <img
                className="spk"
                src="/art/sparkle-11.webp"
                alt=""
                style={{ right: '20%', top: '26%', width: 28 }}
              />
              {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
              <img
                className="spk"
                src="/art/sparkle-4.webp"
                alt=""
                style={{ right: '24%', bottom: '20%', width: 24 }}
              />
              <div className="reni">
                {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                <img src="/art/reni-key.webp" alt="Reni holding a key" loading="lazy" />
              </div>
            </div>
            <div>
              <span className="ktag rv">Security</span>
              <h2 className="rv d1">Only you can move your dollars.</h2>
              <p className="lede rv d2">
                Ren is a self-custody wallet. Your passkey opens it, and Ren’s servers never see it.
              </p>
              <ul className="grid-checks rv d3">
                <li>
                  <b>
                    <span className="ck">
                      <I id="check" />
                    </span>
                    Face ID, no seed phrase
                  </b>
                  <span>Your wallet opens with a passkey.</span>
                </li>
                <li>
                  <b>
                    <span className="ck">
                      <I id="check" />
                    </span>
                    Limits that hold
                  </b>
                  <span>A key can’t spend past its limit. Not even Ren can raise it.</span>
                </li>
                <li>
                  <b>
                    <span className="ck">
                      <I id="check" />
                    </span>
                    Checked on {chainName}
                  </b>
                  <span>Nothing says Paid until it’s on the chain.</span>
                </li>
                <li>
                  <b>
                    <span className="ck">
                      <I id="check" />
                    </span>
                    Straight to you
                  </b>
                  <span>Money lands in your own wallet. Ren never holds it.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Shops, then developers ---------------------------------------------------------- */}
        <section className="dark" id="business">
          <div className="spot" aria-hidden="true" />
          <div className="sec">
            <div className="wrap">
              <div className="biz-top">
                <div>
                  <span className="ktag rv">Ren for shops</span>
                  <h2 className="rv d1">Your phone is the till.</h2>
                  <p className="lede rv d2">
                    Customers tap or scan. The money lands in your own wallet in about a second,
                    with no card fees and no waiting days to get paid.
                  </p>
                </div>
                <div className="ctas rv d2">
                  <a className="btn b-coral" href="/wallet/shop?go=open">
                    Open a shop, free{' '}
                    <span className="o">
                      <I id="arrow" />
                    </span>
                  </a>
                  <form action={signInDemo}>
                    <button type="submit" className="btn b-ghost">
                      Try the demo shop
                    </button>
                  </form>
                </div>
              </div>
              <div className="flow">
                <div className="fl rv">
                  <span className="num">01</span>
                  <h3>Ring it up</h3>
                  <div className="crop">
                    <Screen
                      src="till-code"
                      top="#fddfe7"
                      alt="The till: $3.50 for a cinnamon bun, with a code to scan, waiting for payment"
                    />
                  </div>
                </div>
                <div className="fl rv d1">
                  <span className="num">02</span>
                  <h3>Paid in about a second</h3>
                  <div className="crop">
                    <Screen
                      src="till-paid"
                      top="#f6f1f0"
                      alt="Paid: $3.50 for a cinnamon bun, settled on Tempo"
                    />
                  </div>
                </div>
                <div className="fl rv d2">
                  <span className="num">03</span>
                  <h3>See your day at a glance</h3>
                  <div className="crop">
                    <Screen
                      src="shop-today"
                      top="#f6f1f0"
                      alt="Mia’s Bakery today: $12.25 taken from 4 payments, $0.00 in card fees"
                    />
                  </div>
                </div>
              </div>
              <div className="kbiz-cols">
                <div className="rv">
                  <I id="phone" />
                  <b>Staff phones</b>
                  <span>Pair any phone with a code. It can only take payments.</span>
                </div>
                <div className="rv d1">
                  <I id="store" />
                  <b>Your shop online</b>
                  <span>A menu with photos, table codes and stamp cards.</span>
                </div>
                <div className="rv d2">
                  <I id="list" />
                  <b>Every sale, listed</b>
                  <span>Takings as they land, and a file for your books.</span>
                </div>
                <div className="rv d3">
                  <I id="wallet" />
                  <b>Straight to you</b>
                  <span>Sales land in your own wallet. There’s nothing to withdraw.</span>
                </div>
              </div>

              <div className="devx" id="developers">
                <div>
                  <span className="ktag rv">For developers</span>
                  <h2 className="rv d1">One POST to charge. A signed webhook when it’s paid.</h2>
                  <p className="lede rv d2">
                    Retries are safe with an Idempotency-Key, and every payment is matched on{' '}
                    {chainName}. Shops take machine payments over MPP, and AI agents pay over MCP
                    within a limit you set.
                  </p>
                  <div className="ctas dev-ctas rv d3">
                    <a className="btn b-coral" href="/wallet/shop?go=open">
                      Get API keys{' '}
                      <span className="o">
                        <I id="arrow" />
                      </span>
                    </a>
                    <a className="btn b-ghost" href="/wallet/keys">
                      Make an agent key
                    </a>
                  </div>
                </div>
                <div className="kcode rv d2">
                  <div className="code-top" role="tablist">
                    {(['Charge', 'Webhook', 'AI agent'] as const).map((label, i) => (
                      <button
                        type="button"
                        className="ct"
                        role="tab"
                        aria-selected={i === 0}
                        data-code={i}
                        key={label}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {CODE.map((html, i) => (
                    <pre
                      key={html.slice(0, 24)}
                      data-c={i}
                      hidden={i > 0}
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: fixed, pre-coloured example code written in this file
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Questions ----------------------------------------------------------------------- */}
        <section className="sec" id="faq">
          <div className="wrap faq">
            <div>
              <span className="ktag rv">Help</span>
              <h2 className="rv d1">Questions, answered.</h2>
              <div className="help rv d2">
                {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
                <img src="/art/reni-catch.webp" alt="" />
                <div>
                  <b>The quickest answer</b>
                  <span>
                    <a href="/wallet">Open the wallet</a> and try it. Test dollars are free.
                  </span>
                </div>
              </div>
            </div>
            <div className="rv d1">
              <Qa q="What is Ren?" open>
                A dollar wallet that opens with Face ID. Hold dollars, pay shops and send to
                friends, and give a card, a person or an AI agent a key with its own limit. It runs
                on {chainName}, so payments land in about a second.
              </Qa>
              {mainnet ? null : (
                <Qa q="Is this money I can spend today?">
                  Not yet. Ren runs on {chainName}’s test network, so the dollars are test dollars.
                  The wallet gives you $5 of them a day, free, so you can try every payment exactly
                  as it will work.
                </Qa>
              )}
              <Qa q="What is a key?">
                A key lets a person, a card or an AI agent spend from your wallet, up to a limit you
                set and until a date you choose. {chainName} enforces the limit, so a key can’t go
                over it. Freeze or remove a key whenever you like.
              </Qa>
              <Qa q="Where are my dollars kept?">
                In your own wallet on {chainName}, as {dollar}, a dollar stablecoin. Only your
                passkey can move them. Ren never holds them.
              </Qa>
              <Qa q="What does it cost?">
                Paying a shop and sending to a friend cost you nothing: Ren covers the network fee.
                Shops pay no card fees.
              </Qa>
              <Qa q="What if I get a new phone?">
                Your passkey is kept by your phone’s password manager and syncs with your Apple or
                Google account, so the same passkey opens the same wallet on a new phone.
              </Qa>
              <Qa q="Is Ren a bank?">
                No. Ren is a self-custody wallet: the dollars stay yours and in your control. Ren
                never lends them out.
              </Qa>
            </div>
          </div>
        </section>

        {/* Closing ------------------------------------------------------------------------- */}
        <section className="cta" id="get">
          <div className="wrap">
            <h2 className="rv">
              <span className="soft">Get started.</span>
              <br />
              {/* biome-ignore lint/performance/noImgElement: pre-sized WebP art */}
              Open <img src="/art/reni-cheer.webp" alt="" /> Ren.
            </h2>
            <div className="stores rv d2">
              <a className="kstore" href="/wallet">
                <I id="globe" />
                <span>
                  <small>No download</small>
                  <b>Open Ren on the web</b>
                </span>
              </a>
              <a className="kstore soft" href="/wallet/shop?go=open">
                <I id="store" />
                <span>
                  <small>Free to start</small>
                  <b>Open a shop</b>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter chain={chainName} mainnet={mainnet} />
      <HomeMotion />
    </div>
  )
}
