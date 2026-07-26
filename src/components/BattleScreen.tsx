import { useEffect, useRef, useState } from 'react'
import { FIELD_H, FIELD_W, STATS, battleResult, tickBattle } from '../game/battle'
import { sfx } from '../game/audio'
import type { BattleUnit } from '../game/battle'
import { UNIT_IMG } from './MapScreen'
import type { BannerDesign, UnitType } from '../game/types'
import { DEFAULT_BANNER } from '../game/types'

interface Props {
  initialUnits: BattleUnit[]
  provinceName: string
  enemyName: string
  banner?: BannerDesign
  onFinish: (units: BattleUnit[], winner: 'player' | 'enemy') => void
}

// Görsel efektler (mermi, patlama, kılıç şavkı)
interface Fx { kind: 'arrow' | 'cannon' | 'melee' | 'boom' | 'smoke'; x1: number; y1: number; x2: number; y2: number; t: number; ttl: number }

// Savaş alanı dekorları (deterministik ağaç/kaya/çalı)
function makeDecor(): { x: number; y: number; k: number; s: number }[] {
  const arr: { x: number; y: number; k: number; s: number }[] = []
  for (let i = 0; i < 26; i++) {
    const x = (i * 137 + 53) % FIELD_W
    const y = 25 + ((i * 89 + 31) % (FIELD_H - 60))
    // merkez savaş koridorunu boş bırak
    if (x > FIELD_W * 0.25 && x < FIELD_W * 0.75 && y > FIELD_H * 0.2 && y < FIELD_H * 0.8) continue
    arr.push({ x, y, k: i % 3, s: 0.7 + ((i * 7) % 10) / 14 })
  }
  return arr
}
const DECOR = makeDecor()

export default function BattleScreen({ initialUnits, provinceName, enemyName, banner, onFinish }: Props) {
  const bd = banner ?? DEFAULT_BANNER
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unitsRef = useRef<BattleUnit[]>(initialUnits)
  const fxRef = useRef<Fx[]>([])
  const lastCannon = useRef(0)
  const lastClash = useRef(0)
  const imgsRef = useRef<Record<string, HTMLImageElement | null>>({ bg: null, piyade: null, okcu: null, suvari: null })
  const [selected, setSelected] = useState<number | null>(null)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [winner, setWinner] = useState<'player' | 'enemy' | null>(null)

  useEffect(() => { speedRef.current = speed }, [speed])

  // Görselleri yükle
  useEffect(() => {
    const load = (key: string, src: string) => {
      const im = new Image()
      im.src = src
      im.onload = () => { imgsRef.current[key] = im }
      im.onerror = () => { imgsRef.current[key] = null }
    }
    load('bg', '/img/battle_bg.jpg')
    ;(['piyade', 'okcu', 'suvari', 'topcu'] as UnitType[]).forEach(t => load(t, UNIT_IMG[t]))
  }, [])

  // Oyun döngüsü
  useEffect(() => {
    let last = performance.now()
    let raf: number
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speedRef.current
      last = now
      if (!winner && dt > 0) {
        tickBattle(unitsRef.current, dt, (u, tgt) => {
          // görsel efekt üret
          const fx = fxRef.current
          if (u.type === 'okcu') fx.push({ kind: 'arrow', x1: u.x, y1: u.y - 10, x2: tgt.x, y2: tgt.y, t: 0, ttl: 0.35 })
          else if (u.type === 'topcu') {
            fx.push({ kind: 'cannon', x1: u.x, y1: u.y - 8, x2: tgt.x, y2: tgt.y, t: 0, ttl: 0.7 })
            fx.push({ kind: 'smoke', x1: u.x, y1: u.y - 8, x2: u.x, y2: u.y - 8, t: 0, ttl: 0.9 })
            fx.push({ kind: 'boom', x1: tgt.x, y1: tgt.y, x2: tgt.x, y2: tgt.y, t: 0, ttl: 0.5 })
          } else fx.push({ kind: 'melee', x1: (u.x + tgt.x) / 2, y1: (u.y + tgt.y) / 2 - 6, x2: tgt.x, y2: tgt.y, t: 0, ttl: 0.2 })
          if (fx.length > 120) fx.splice(0, fx.length - 120)
          // saldırı sesi (kısıtlı sıklık)
          const now = performance.now()
          if (u.type === 'topcu') { if (now - lastCannon.current > 700) { lastCannon.current = now; sfx('/ses/top.mp3', 0.35) } }
          else if (now - lastClash.current > 500 && Math.random() < 0.5) { lastClash.current = now; sfx('/ses/kilic.mp3', 0.2) }
        })
        fxRef.current.forEach(f => { f.t += dt })
        fxRef.current = fxRef.current.filter(f => f.t < f.ttl)
        const r = battleResult(unitsRef.current)
        if (r) setWinner(r)
      }
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [winner, selected])

  const draw = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const W = c.width, H = c.height
    const sx = W / FIELD_W, sy = H / FIELD_H

    const bg = imgsRef.current.bg
    if (bg) {
      ctx.drawImage(bg, 0, 0, W, H)
      ctx.fillStyle = 'rgba(20,30,20,0.25)'
      ctx.fillRect(0, 0, W, H)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#4a7c3a'); g.addColorStop(1, '#33592a')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    }

    // === DEKOR: ağaç, kaya, çalı ===
    for (const d of DECOR) {
      const dx = d.x * sx, dy = d.y * sy, ds = d.s * sx
      ctx.save()
      ctx.globalAlpha = 0.85
      if (d.k === 0) { // çam ağacı
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath(); ctx.ellipse(dx, dy + 9 * ds, 7 * ds, 2.5 * ds, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#4a3a26'; ctx.fillRect(dx - 1.2 * ds, dy, 2.4 * ds, 8 * ds)
        ctx.fillStyle = '#1e3d1f'
        for (let t = 0; t < 3; t++) {
          const tw = (10 - t * 2.6) * ds, ty = dy - t * 6.5 * ds
          ctx.beginPath(); ctx.moveTo(dx, ty - 10 * ds); ctx.lineTo(dx - tw / 2, ty + 2 * ds); ctx.lineTo(dx + tw / 2, ty + 2 * ds); ctx.closePath(); ctx.fill()
        }
        ctx.fillStyle = 'rgba(120,180,110,0.25)'
        ctx.beginPath(); ctx.moveTo(dx, dy - 16 * ds); ctx.lineTo(dx - 3 * ds, dy - 8 * ds); ctx.lineTo(dx + 1 * ds, dy - 8 * ds); ctx.closePath(); ctx.fill()
      } else if (d.k === 1) { // kaya
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.beginPath(); ctx.ellipse(dx, dy + 3 * ds, 8 * ds, 2 * ds, 0, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#6b6f6a'
        ctx.beginPath(); ctx.moveTo(dx - 7 * ds, dy + 2 * ds); ctx.lineTo(dx - 3 * ds, dy - 5 * ds); ctx.lineTo(dx + 3 * ds, dy - 6 * ds); ctx.lineTo(dx + 7 * ds, dy + 2 * ds); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#8a8f88'
        ctx.beginPath(); ctx.moveTo(dx - 3 * ds, dy - 5 * ds); ctx.lineTo(dx + 3 * ds, dy - 6 * ds); ctx.lineTo(dx + 5 * ds, dy - 1 * ds); ctx.lineTo(dx - 1 * ds, dy); ctx.closePath(); ctx.fill()
      } else { // çalı
        ctx.fillStyle = '#2d4a24'
        ctx.beginPath(); ctx.arc(dx - 3 * ds, dy, 4 * ds, 0, Math.PI * 2); ctx.arc(dx + 3 * ds, dy - 1 * ds, 4.5 * ds, 0, Math.PI * 2); ctx.arc(dx, dy + 2 * ds, 3.5 * ds, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    }

    for (const u of unitsRef.current) {
      if (u.dead) continue
      const x = u.x * sx, y = u.y * sy
      const st = STATS[u.type]
      const isPlayer = u.side === 'player'
      const sideColor = isPlayer ? bd.field : '#dc2626'

      // menzil göstergesi (seçili okçu/topçu)
      if (u.id === selected && st.range > 30) {
        ctx.beginPath(); ctx.arc(x, y, st.range * sx, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(20,184,166,0.07)'; ctx.fill()
        ctx.strokeStyle = 'rgba(20,184,166,0.35)'; ctx.stroke()
      }

      // seçim halkası (formasyon çevresi)
      if (u.id === selected) {
        ctx.beginPath(); ctx.ellipse(x, y, 30 * sx, 24 * sy, 0, 0, Math.PI * 2)
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([])
      }

      // === FORMASYON: küçük asker kafilesi ===
      const total = st.soldiers
      const aliveN = Math.max(1, Math.ceil((u.hp / u.maxHp) * total))
      const offs = formationOffsets(u.id, total)
      const img = imgsRef.current[u.type]
      ctx.save()
      if (u.routing) ctx.globalAlpha = 0.45
      for (let i = 0; i < aliveN; i++) {
        const ox = offs[i][0] * sx, oy = offs[i][1] * sy
        const sxp = x + ox, syp = y + oy
        // gölge
        ctx.beginPath(); ctx.ellipse(sxp, syp + 6, 6, 2.5, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill()
        const S = u.type === 'topcu' ? 17 : 13
        if (img) {
          // her askeri daire içinde çiz (sprite arkaplanı görünmesin)
          ctx.save()
          ctx.beginPath(); ctx.arc(sxp, syp, S / 2, 0, Math.PI * 2); ctx.clip()
          ctx.drawImage(img, sxp - S / 2, syp - S / 2, S, S)
          ctx.restore()
        } else {
          ctx.beginPath(); ctx.arc(sxp, syp, S / 2.5, 0, Math.PI * 2)
          ctx.fillStyle = sideColor; ctx.fill()
        }
      }
      ctx.restore()

      // === SANCAK ===
      const bx = x, by = y - 34
      ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + 16); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + 14, by + 4)
      ctx.lineTo(bx, by + 8)
      ctx.closePath()
      ctx.fillStyle = u.routing ? '#6b7280' : sideColor
      ctx.fill()
      ctx.strokeStyle = u.id === selected ? '#fbbf24' : 'rgba(0,0,0,0.6)'
      ctx.lineWidth = 1; ctx.stroke()
      // oyuncu sancağına amblem işle
      if (isPlayer && bd.emblem && !u.routing) {
        ctx.font = '6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = bd.emblemColor
        ctx.fillText(bd.emblem, bx + 5, by + 4.5)
      }
      // birlik tipi simgesi bayrağın yanında
      ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(st.icon, bx + 3, by + 12)

      // can + moral barları (formasyonun altında)
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 16, y + 24, 32, 4)
      ctx.fillStyle = u.hp > 50 ? '#4ade80' : u.hp > 25 ? '#facc15' : '#f87171'
      ctx.fillRect(x - 16, y + 24, 32 * Math.max(0, u.hp / u.maxHp), 4)
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 16, y + 29, 32, 3)
      ctx.fillStyle = '#60a5fa'
      ctx.fillRect(x - 16, y + 29, 32 * Math.max(0, u.morale / 100), 3)

      // hareket hedefi
      if (u.id === selected && !u.routing) {
        ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(251,191,36,0.7)'
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(u.tx * sx, u.ty * sy); ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // === EFEKTLER: ok, gülle, patlama, kılıç şavkı ===
    for (const f of fxRef.current) {
      const p = f.t / f.ttl
      const x1 = f.x1 * sx, y1 = f.y1 * sy, x2 = f.x2 * sx, y2 = f.y2 * sy
      ctx.save()
      if (f.kind === 'arrow') {
        const px = x1 + (x2 - x1) * p, py = y1 + (y2 - y1) * p - Math.sin(p * Math.PI) * 26 * sy
        const ang = Math.atan2(y2 - y1, x2 - x1)
        ctx.strokeStyle = 'rgba(240,230,200,0.95)'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * 8, py - Math.sin(ang) * 8); ctx.lineTo(px, py); ctx.stroke()
      } else if (f.kind === 'cannon') {
        const px = x1 + (x2 - x1) * p, py = y1 + (y2 - y1) * p - Math.sin(p * Math.PI) * 60 * sy
        ctx.fillStyle = '#1c1917'
        ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.stroke()
      } else if (f.kind === 'boom') {
        const r = 6 + p * 26
        ctx.globalAlpha = 1 - p
        const g = ctx.createRadialGradient(x1, y1, 0, x1, y1, r)
        g.addColorStop(0, '#fde68a'); g.addColorStop(0.5, '#f97316'); g.addColorStop(1, 'rgba(120,53,15,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x1, y1, r, 0, Math.PI * 2); ctx.fill()
      } else if (f.kind === 'smoke') {
        ctx.globalAlpha = 0.4 * (1 - p)
        ctx.fillStyle = '#d6d3d1'
        ctx.beginPath(); ctx.arc(x1 - p * 10, y1 - p * 16, 5 + p * 12, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x1 + p * 6, y1 - p * 22, 4 + p * 9, 0, Math.PI * 2); ctx.fill()
      } else { // melee şavkı
        ctx.globalAlpha = 1 - p
        ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 2.2
        ctx.beginPath(); ctx.arc(x1, y1, 5 + p * 8, -0.6, 2.2); ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x1 - 6, y1 + 4); ctx.lineTo(x1 + 6, y1 - 5); ctx.stroke()
      }
      ctx.restore()
    }

    // === Vinyet + ışık ===
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)')
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
    const sun = ctx.createLinearGradient(0, 0, 0, H)
    sun.addColorStop(0, 'rgba(255,240,200,0.10)'); sun.addColorStop(0.35, 'rgba(0,0,0,0)')
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H)
  }

  // Birlik merkezine göre deterministik formasyon dizilimi
  function formationOffsets(id: number, n: number): [number, number][] {
    const arr: [number, number][] = []
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols
      const jx = ((id * 37 + i * 13) % 7) - 3
      const jy = ((id * 53 + i * 29) % 7) - 3
      arr.push([(c - (cols - 1) / 2) * 13 + jx, (r - (rows - 1) / 2) * 13 + jy])
    }
    return arr
  }

  const toField = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (FIELD_W / r.width), y: (e.clientY - r.top) * (FIELD_H / r.height) }
  }

  const onTap = (e: React.PointerEvent) => {
    if (winner) return
    const p = toField(e)
    const units = unitsRef.current
    const hit = units.filter(u => !u.dead).find(u => Math.hypot(u.x - p.x, u.y - p.y) < 32)
    if (hit && hit.side === 'player' && !hit.routing) { setSelected(hit.id); return }
    if (selected != null) {
      const u = units.find(u => u.id === selected)
      if (u && !u.dead && !u.routing) {
        if (hit && hit.side === 'enemy') {
          u.targetEnemy = hit.id
        } else {
          u.tx = Math.max(10, Math.min(FIELD_W - 10, p.x))
          u.ty = Math.max(15, Math.min(FIELD_H - 15, p.y))
          u.targetEnemy = null
        }
      }
    }
  }

  const myUnits = unitsRef.current.filter(u => u.side === 'player' && !u.dead)
  const sel = selected != null ? unitsRef.current.find(u => u.id === selected) : null

  return (
    <div className="h-full relative bg-slate-950 text-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div>
          <div className="font-bold text-sm">⚔️ {provinceName} Muharebesi</div>
          <div className="text-[11px] text-slate-400">Düşman: {enemyName}</div>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`px-2.5 py-1 rounded text-xs font-bold ${speed === s ? 'bg-teal-600' : 'bg-slate-700'}`}>
              {s === 0 ? '⏸' : `${s}x`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col landscape:flex-row min-h-0">
        {/* Savaş alanı */}
        <div className="relative h-[55%] landscape:h-auto landscape:flex-1 min-w-0 flex-shrink-0">
          <canvas ref={canvasRef} width={900} height={520} onPointerDown={onTap}
            className="absolute inset-0 w-full h-full touch-none select-none cursor-crosshair object-fill" />
        </div>

        {/* Sağ birlik paneli */}
        <div className="flex-1 landscape:flex-none landscape:w-[170px] bg-slate-900 border-t landscape:border-t-0 landscape:border-l border-slate-700 flex flex-col min-h-0">
          <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-300 border-b border-slate-700">Birliklerin</div>
          <div className="flex-1 overflow-y-auto p-1.5 flex landscape:flex-col gap-1.5 min-h-0 overflow-x-auto landscape:overflow-x-hidden">
            {myUnits.map(u => (
              <button key={u.id} onClick={() => setSelected(u.id === selected ? null : u.id)}
                className={`h-16 landscape:h-auto landscape:w-full flex-shrink-0 flex items-center gap-2 p-1.5 rounded-lg text-left border transition ${u.id === selected ? 'border-amber-400 bg-slate-800' : 'border-slate-700 bg-slate-800/50'} ${u.routing ? 'opacity-40' : ''}`}>
                <img src={UNIT_IMG[u.type]} className="w-9 h-9 rounded-full object-cover border-2 border-teal-600 flex-shrink-0" alt="" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate">{STATS[u.type].label}</div>
                  <div className="text-[10px] text-slate-400">{u.routing ? 'KAÇIYOR!' : `❤${Math.max(0, Math.round(u.hp))} · 💙${Math.round(u.morale)}`}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-1.5 text-[10px] text-slate-400 border-t border-slate-700">
            {sel ? 'Haritaya dokun: hareket · düşmana dokun: saldırı' : 'Komuta için birlik seç'}
          </div>
        </div>
      </div>

      {winner && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-slate-600 rounded-2xl p-6 text-center max-w-sm w-full">
            <div className="text-4xl mb-2">{winner === 'player' ? '🏆' : '💀'}</div>
            <div className="text-xl font-bold mb-1">{winner === 'player' ? 'ZAFER!' : 'YENİLGİ'}</div>
            <div className="text-sm text-slate-400 mb-4">
              {winner === 'player' ? 'Düşman ordusu bozguna uğratıldı.' : 'Ordumuz dağıldı...'}
            </div>
            <button onClick={() => onFinish(unitsRef.current, winner)}
              className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold">
              Haritaya Dön
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
