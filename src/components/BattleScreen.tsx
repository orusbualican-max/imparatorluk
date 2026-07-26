import { useEffect, useRef, useState } from 'react'
import { FIELD_H, FIELD_W, STATS, battleResult, tickBattle } from '../game/battle'
import { sfx } from '../game/audio'
import type { BattleUnit } from '../game/battle'
import { UNIT_IMG } from './MapScreen'
import type { UnitType } from '../game/types'

interface Props {
  initialUnits: BattleUnit[]
  provinceName: string
  enemyName: string
  onFinish: (units: BattleUnit[], winner: 'player' | 'enemy') => void
}

export default function BattleScreen({ initialUnits, provinceName, enemyName, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const unitsRef = useRef<BattleUnit[]>(initialUnits)
  const lastCannon = useRef(0)
  const lastClash = useRef(0)
  const imgsRef = useRef<Record<string, HTMLImageElement | null>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [winner, setWinner] = useState<'player' | 'enemy' | null>(null)

  useEffect(() => { speedRef.current = speed }, [speed])

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

  useEffect(() => {
    let last = performance.now()
    let raf: number
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speedRef.current
      last = now
      if (!winner && dt > 0) {
        tickBattle(unitsRef.current, dt, (u) => {
          const now = performance.now()
          if (u.type === 'topcu') { if (now - lastCannon.current > 700) { lastCannon.current = now; sfx('/ses/top.mp3', 0.35) } }
          else if (now - lastClash.current > 500 && Math.random() < 0.5) { lastClash.current = now; sfx('/ses/kilic.mp3', 0.2) }
        })
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
    ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
    ctx.setLineDash([])

    for (const u of unitsRef.current) {
      if (u.dead) continue
      const x = u.x * sx, y = u.y * sy
      const st = STATS[u.type]
      const isPlayer = u.side === 'player'
      const R = 17

      if (u.id === selected && u.type === 'okcu') {
        ctx.beginPath(); ctx.arc(x, y, st.range * sx, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(20,184,166,0.08)'; ctx.fill()
        ctx.strokeStyle = 'rgba(20,184,166,0.4)'; ctx.stroke()
      }

      ctx.beginPath(); ctx.ellipse(x, y + R * 0.75, R * 0.9, R * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill()

      const img = imgsRef.current[u.type]
      ctx.save()
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip()
      if (img) {
        ctx.drawImage(img, x - R, y - R, R * 2, R * 2)
        if (u.routing) { ctx.fillStyle = 'rgba(80,80,80,0.55)'; ctx.fillRect(x - R, y - R, R * 2, R * 2) }
      } else {
        ctx.fillStyle = u.routing ? '#6b7280' : isPlayer ? '#14b8a6' : '#dc2626'
        ctx.fillRect(x - R, y - R, R * 2, R * 2)
      }
      ctx.restore()
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.lineWidth = u.id === selected ? 3.5 : 2.5
      ctx.strokeStyle = u.id === selected ? '#fbbf24' : isPlayer ? '#14b8a6' : '#dc2626'
      ctx.stroke()

      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 15, y - R - 10, 30, 4)
      ctx.fillStyle = u.hp > 50 ? '#4ade80' : u.hp > 25 ? '#facc15' : '#f87171'
      ctx.fillRect(x - 15, y - R - 10, 30 * Math.max(0, u.hp / u.maxHp), 4)
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 15, y - R - 5, 30, 3)
      ctx.fillStyle = '#60a5fa'
      ctx.fillRect(x - 15, y - R - 5, 30 * Math.max(0, u.morale / 100), 3)

      if (u.id === selected && !u.routing) {
        ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(251,191,36,0.7)'
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(u.tx * sx, u.ty * sy); ctx.stroke()
        ctx.setLineDash([])
      }
    }
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
    const hit = units.filter(u => !u.dead).find(u => Math.hypot(u.x - p.x, u.y - p.y) < 24)
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
        <div className="relative h-[55%] landscape:h-auto landscape:flex-1 min-w-0 flex-shrink-0">
          <canvas ref={canvasRef} width={900} height={520} onPointerDown={onTap}
            className="absolute inset-0 w-full h-full touch-none select-none cursor-crosshair object-fill" />
        </div>

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
