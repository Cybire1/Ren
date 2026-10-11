/**
 * The Register's Orders board, live (1440 × 900): online and counter orders in one queue. Tomás's
 * cake goes to Preparing, Leo's latte is marked ready, Sofia collects hers, and a new order lands.
 * Cards travel between columns on the hero ease and lift while they move.
 */
import { AbsoluteFill } from 'remotion'
import { BEAT, bounce, CORAL, Finger, font, GREEN, hero, INK, MUTED, mix, money, PAPER, span, SUNKEN, SURFACE, tapAt, TEAL } from './kit'
import { Rail } from './Rail'

type Col = 'new' | 'preparing' | 'ready'
type Card = { id: string; name: string; tone: string; item: string; price: number; note?: string; allergy?: boolean; mins: number }

const CARDS: Card[] = [
  { id: 'tomas', name: 'Tomás', tone: '#E8C15A', item: 'Carrot cake', price: 5, note: 'It’s a birthday, a candle if you have one', mins: 2 },
  { id: 'priya', name: 'Priya', tone: '#EBB3AA', item: 'Cinnamon bun', price: 3.75, note: 'Allergy: no nuts, please', allergy: true, mins: 3 },
  { id: 'maya', name: 'Maya', tone: TEAL, item: 'Flat white', price: 4.5, note: 'Oat milk, please', mins: 4 },
  { id: 'leo', name: 'Leo', tone: TEAL, item: 'Iced latte', price: 4.75, mins: 12 },
  { id: 'jonas', name: 'Jonas', tone: '#E8C15A', item: 'Baguette', price: 3, mins: 6 },
  { id: 'sofia', name: 'Sofia', tone: '#EBB3AA', item: 'Croissant', price: 3.25, mins: 9 },
  { id: 'noor', name: 'Noor', tone: '#C9B8E8', item: 'Sourdough loaf', price: 6.5, note: 'Sliced, please', mins: 0 },
]

/** The taps that move the board, in seconds from the start of the screen. */
export const ORDER_TAPS = { start: 2 * BEAT, ready: 4 * BEAT, handed: 6 * BEAT, arrives: 7 * BEAT }

type Board = Record<Col, string[]>
type Taps = typeof ORDER_TAPS
const START: Board = { new: ['tomas', 'priya', 'maya'], preparing: ['leo', 'jonas'], ready: ['sofia'] }
const move = (board: Board, id: string, to: Col | null): Board => {
  const next = { new: board.new.filter((x) => x !== id), preparing: board.preparing.filter((x) => x !== id), ready: board.ready.filter((x) => x !== id) }
  if (to) next[to] = [...next[to], id]
  return next
}
/** The board after each event, in time order: Tomás starts, Leo is ready, Sofia collects, Noor orders. */
function stagesFor(taps: Taps) {
  const events: { at: number; apply: (b: Board) => Board }[] = [
    { at: taps.start, apply: (b) => move(b, 'tomas', 'preparing') },
    { at: taps.ready, apply: (b) => move(b, 'leo', 'ready') },
    { at: taps.handed, apply: (b) => move(b, 'sofia', null) },
    { at: taps.arrives, apply: (b) => move(b, 'noor', 'new') },
  ]
  events.sort((x, y) => x.at - y.at)
  const stages = [{ at: -1, board: START }]
  for (const e of events) stages.push({ at: e.at, board: e.apply(stages[stages.length - 1]!.board) })
  return stages
}

const COLS: { key: Col; label: string; dot: string }[] = [
  { key: 'new', label: 'New', dot: CORAL },
  { key: 'preparing', label: 'Preparing', dot: '#E8C15A' },
  { key: 'ready', label: 'Ready', dot: TEAL },
]
const COL_X = [132, 565, 997]
const COL_W = 415
const CARD_W = COL_W - 32
const TOP = 112 + 64
const height = (c: Card) => (c.note ? 252 : 198)
const card = (id: string) => CARDS.find((c) => c.id === id)!

function place(board: Board, id: string) {
  for (const [ci, col] of COLS.entries()) {
    const list = board[col.key]
    const i = list.indexOf(id)
    if (i < 0) continue
    const y = TOP + list.slice(0, i).reduce((s, x) => s + height(card(x)) + 14, 0)
    return { x: COL_X[ci]! + 16, y, col: col.key }
  }
  return null
}

const MOVE = 0.6

export function OrdersUI({ t, taps: T = ORDER_TAPS }: { t: number; taps?: Taps }) {
  const STAGES = stagesFor(T)
  const si = STAGES.filter((s) => t >= s.at + 2 / 30).length - 1
  const stage = STAGES[si]!
  const prev = STAGES[Math.max(0, si - 1)]!
  const at = (ev: keyof Taps) => STAGES.find((s) => s.at === T[ev])!
  const p = si === 0 ? 1 : hero(span(t, stage.at + 2 / 30, stage.at + 2 / 30 + MOVE))
  const counts = COLS.map((c) => stage.board[c.key].length)

  const buttonFor = (col: Col) =>
    col === 'new' ? { label: 'Start preparing', bg: INK } : col === 'preparing' ? { label: 'Mark ready', bg: INK } : { label: 'Handed over', bg: GREEN }

  // Where each tap lands: the arrow on the card's button, in the board as it was before the tap.
  const arrow = (board: Board, id: string) => {
    const at = place(board, id)!
    return { x: at.x + CARD_W - 18 - 26, y: at.y + height(card(id)) - 18 - 27 }
  }
  // The board as it stood just before each tap.
  const before = (ev: keyof Taps) => STAGES[STAGES.indexOf(at(ev)) - 1]!.board
  const taps = [
    { at: T.start, ...arrow(before('start'), 'tomas'), id: 'tomas' },
    { at: T.ready, ...arrow(before('ready'), 'leo'), id: 'leo' },
    { at: T.handed, ...arrow(before('handed'), 'sofia'), id: 'sofia' },
  ]

  return (
    <AbsoluteFill style={{ ...font, background: PAPER }}>
      <Rail active="Orders" orders={String(counts[0])} />
      <div style={{ position: 'absolute', left: 132, top: 26 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Orders</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: MUTED, marginTop: 2 }}>Online and at the counter, in one queue. Oldest first.</div>
      </div>
      <div style={{ position: 'absolute', right: 28, top: 48, display: 'flex', gap: 8 }}>
        {[`All ${counts[0]! + counts[1]! + counts[2]!}`, 'Online', 'Counter'].map((c, i) => (
          <div key={c} style={{ height: 46, padding: '0 20px', borderRadius: 23, border: `2px solid ${INK}`, background: i === 0 ? INK : SURFACE, color: i === 0 ? '#fff' : INK, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            {c}
          </div>
        ))}
      </div>
      {COLS.map((c, i) => {
        const changed = prev.board[c.key].length !== stage.board[c.key].length && si > 0
        const pop = changed ? 1 + 0.35 * Math.sin(Math.PI * span(t, stage.at + 0.3, stage.at + 0.7)) : 1
        return (
          <div key={c.key} style={{ position: 'absolute', left: COL_X[i], top: 112, width: COL_W, height: 764, borderRadius: 28, background: SUNKEN }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '22px 22px', fontSize: 21, fontWeight: 800 }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, background: c.dot, border: `2px solid ${INK}` }} />
              <span style={{ flex: 1 }}>{c.label}</span>
              <span style={{ fontSize: 17, color: MUTED, transform: `scale(${pop})` }}>{counts[i]}</span>
            </div>
          </div>
        )
      })}

      {CARDS.map((c) => {
        const from = place(prev.board, c.id)
        const to = place(stage.board, c.id)
        if (!from && !to) return null
        let x: number
        let y: number
        let opacity = 1
        let lift = 0
        let scale = 1
        let col: Col
        if (from && to) {
          // Cards closing a gap wait for the card leaving it.
          const q = from.col === to.col && si > 0 ? hero(span(t, stage.at + 0.3, stage.at + 0.3 + MOVE)) : p
          x = mix(from.x, to.x, q)
          y = mix(from.y, to.y, q)
          lift = from.col !== to.col ? Math.sin(Math.PI * p) : 0
          col = p < 0.5 ? from.col : to.col
        } else if (from) {
          // Collected: it slides off to the right and fades.
          x = from.x + 80 * p
          y = from.y
          opacity = 1 - span(t, stage.at + 0.05, stage.at + 0.35)
          col = from.col
        } else {
          // A new order drops in with the one spring.
          const b = bounce(t, stage.at)
          x = to!.x
          y = to!.y - (1 - b) * 40
          opacity = Math.min(1, b * 2)
          scale = mix(0.9, 1, b)
          col = to!.col
        }
        scale *= 1 + 0.035 * lift
        const btn = buttonFor(col)
        const tap = taps.find((k) => k.id === c.id)
        const press = tap ? tapAt(t, tap.at).press : 0
        const mins = c.mins + Math.floor(t / 60)
        const late = mins >= 10
        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: CARD_W,
              height: height(c),
              boxSizing: 'border-box',
              padding: 18,
              borderRadius: 24,
              border: `2px solid ${INK}`,
              background: SURFACE,
              opacity,
              transform: `scale(${scale}) rotate(${lift * -1.2}deg)`,
              boxShadow: `0 ${4 + 30 * lift}px ${8 + 40 * lift}px -10px rgba(11,26,29,${0.15 + 0.3 * lift})`,
              zIndex: lift > 0 || (from && !to) ? 2 : 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 50 }}>
              <span style={{ width: 48, height: 48, borderRadius: 24, background: c.tone, border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800 }}>{c.name[0]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>Online · paid on Kova</div>
              </div>
              <span style={{ height: 30, padding: '0 12px', borderRadius: 15, background: col === 'ready' ? SUNKEN : late ? CORAL : col === 'preparing' ? '#E8C15A' : SUNKEN, color: late && col !== 'ready' ? '#fff' : INK, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                {col === 'ready' ? 'Ready' : mins === 0 ? 'Now' : `${mins} min`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 34 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800 }}>1</span>
              <span style={{ flex: 1, fontSize: 19, fontWeight: 700 }}>{c.item}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: MUTED }}>{money(c.price)}</span>
            </div>
            {c.note ? (
              <div style={{ height: 40, borderRadius: 14, background: c.allergy ? '#EBB3AA' : SUNKEN, display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 15, fontWeight: 700 }}>{c.note}</div>
            ) : null}
            <div style={{ height: 54, borderRadius: 27, background: btn.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 7px 0 22px', fontSize: 18, fontWeight: 800, transform: `scale(${1 - 0.04 * press})` }}>
              {btn.label}
              <span style={{ width: 40, height: 40, borderRadius: 20, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
            </div>
          </div>
        )
      })}

      {/* "New order" toast as Noor's order lands. */}
      {(() => {
        const a = hero(span(t, T.arrives, T.arrives + 0.5)) * (1 - span(t, T.arrives + 2.4, T.arrives + 2.8))
        return (
          <div style={{ position: 'absolute', left: 720 - 170, top: 18, width: 340, height: 58, borderRadius: 29, background: INK, color: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px 0 20px', boxSizing: 'border-box', fontSize: 16, fontWeight: 700, opacity: a, transform: `translateY(${(1 - a) * -70}px)` }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: CORAL }} />
            <span style={{ flex: 1 }}>New order · Noor · $6.50</span>
            <span style={{ height: 42, padding: '0 14px', borderRadius: 21, background: '#2E5559', display: 'flex', alignItems: 'center', fontSize: 14 }}>Paid</span>
          </div>
        )
      })()}

      {taps.map((k) => (
        <Finger key={k.at} t={t} at={k.at} x={k.x} y={k.y} />
      ))}
    </AbsoluteFill>
  )
}
