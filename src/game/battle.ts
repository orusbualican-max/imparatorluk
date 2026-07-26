import type { ArmyComp, UnitType } from './types'

export interface BattleUnit {
  id: number
  side: 'player' | 'enemy'
  type: UnitType
  x: number; y: number
  tx: number; ty: number
  hp: number; maxHp: number
  morale: number
  targetEnemy: number | null
  cooldown: number
  routing: boolean
  dead: boolean
  kills: number
  dmgMult: number
  moraleResist: number
}

export const STATS: Record<UnitType, { speed: number; range: number; dmg: number; armor: number; label: string; icon: string }> = {
  piyade: { speed: 22, range: 16, dmg: 7, armor: 3, label: 'Piyade', icon: '🛡' },
  okcu: { speed: 20, range: 120, dmg: 5, armor: 0, label: 'Okçu', icon: '🏹' },
  suvari: { speed: 44, range: 16, dmg: 10, armor: 1, label: 'Süvari', icon: '🐎' },
  topcu: { speed: 10, range: 150, dmg: 16, armor: 0, label: 'Topçu', icon: '💣' },
}

export const FIELD_W = 900
export const FIELD_H = 520

let uid = 1

function makeUnit(side: 'player' | 'enemy', type: UnitType, x: number, y: number): BattleUnit {
  return { id: uid++, side, type, x, y, tx: x, ty: y, hp: 100, maxHp: 100, morale: 100, targetEnemy: null, cooldown: 0, routing: false, dead: false, kills: 0, dmgMult: 1, moraleResist: 0 }
}

export interface BattleOpts {
  defSide?: 'player' | 'enemy'
  defBonusHp?: number
  playerDmgMult?: number
  playerMoraleResist?: number
}

export function createBattle(playerArmy: ArmyComp, enemyArmy: ArmyComp, opts?: BattleOpts): BattleUnit[] {
  const units: BattleUnit[] = []
  const place = (side: 'player' | 'enemy', comp: ArmyComp, baseX: number) => {
    const rows: UnitType[] = []
    for (let i = 0; i < (comp.topcu ?? 0); i++) rows.push('topcu')
    for (let i = 0; i < comp.okcu; i++) rows.push('okcu')
    for (let i = 0; i < comp.piyade; i++) rows.push('piyade')
    for (let i = 0; i < comp.suvari; i++) rows.push('suvari')
    const cy = FIELD_H / 2
    rows.forEach((t, i) => {
      const off = (i - (rows.length - 1) / 2) * 56
      const back = t === 'okcu' ? 40 : t === 'topcu' ? 70 : 0
      const x = side === 'player' ? baseX - back : baseX + back
      units.push(makeUnit(side, t, x + (Math.random() * 10 - 5), cy + off))
    })
  }
  place('player', playerArmy, 120)
  place('enemy', enemyArmy, FIELD_W - 120)
  if (opts?.defBonusHp && opts.defSide) {
    units.filter(u => u.side === opts.defSide).forEach(u => { u.maxHp += opts.defBonusHp!; u.hp += opts.defBonusHp! })
  }
  units.filter(u => u.side === 'player').forEach(u => {
    u.dmgMult = opts?.playerDmgMult ?? 1
    u.moraleResist = opts?.playerMoraleResist ?? 0
  })
  return units
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

export function tickBattle(units: BattleUnit[], dt: number, onAttack?: (u: BattleUnit) => void): void {
  const alive = units.filter(u => !u.dead)
  for (const u of alive) {
    const st = STATS[u.type]
    if (u.cooldown > 0) u.cooldown -= dt

    if (u.routing) {
      u.tx = u.side === 'player' ? -40 : FIELD_W + 40
      moveToward(u, st.speed * 1.2, dt)
      if (u.x < -20 || u.x > FIELD_W + 20) u.dead = true
      continue
    }

    let target = u.targetEnemy != null ? alive.find(e => e.id === u.targetEnemy && !e.dead) : undefined
    if (u.side === 'enemy') {
      const foes = alive.filter(e => e.side === 'player')
      if (foes.length) {
        const nearest = foes.reduce((a, b) => dist(u, a) < dist(u, b) ? a : b)
        u.targetEnemy = nearest.id
        target = nearest
      }
    } else if (!target) {
      const foes = alive.filter(e => e.side === 'enemy')
      const inRange = foes.filter(e => dist(u, e) <= st.range)
      if (inRange.length) target = inRange.reduce((a, b) => dist(u, a) < dist(u, b) ? a : b)
    }

    if (target && !target.dead) {
      const d = dist(u, target)
      if (d <= st.range) {
        if (u.cooldown <= 0) {
          const armor = STATS[target.type].armor
          const dmg = Math.max(2, (st.dmg * u.dmgMult) - armor + Math.random() * 3)
          target.hp -= dmg
          target.morale -= dmg * 0.8 * (1 - target.moraleResist)
          u.cooldown = u.type === 'okcu' ? 1.6 : u.type === 'topcu' ? 2.4 : 1.0
          if (onAttack) onAttack(u)
          if (target.hp <= 0 && !target.dead) { target.dead = true; u.kills++ }
          if (target.morale <= 20 && !target.routing) target.routing = true
        }
      } else {
        if (u.side === 'enemy' || u.targetEnemy != null) {
          u.tx = target.x; u.ty = target.y
        }
      }
    }
    moveToward(u, st.speed, dt)
    u.morale = Math.min(100, u.morale + dt * 1.2)
  }
}

function moveToward(u: BattleUnit, speed: number, dt: number) {
  const dx = u.tx - u.x, dy = u.ty - u.y
  const d = Math.hypot(dx, dy)
  if (d < 2) return
  const step = Math.min(d, speed * dt)
  u.x += (dx / d) * step
  u.y += (dy / d) * step
  u.x = Math.max(-50, Math.min(FIELD_W + 50, u.x))
  u.y = Math.max(10, Math.min(FIELD_H - 10, u.y))
}

export function battleResult(units: BattleUnit[]): 'player' | 'enemy' | null {
  const p = units.filter(u => u.side === 'player' && !u.dead)
  const e = units.filter(u => u.side === 'enemy' && !u.dead)
  if (p.length === 0) return 'enemy'
  if (e.length === 0) return 'player'
  return null
}

export function survivors(units: BattleUnit[], side: 'player' | 'enemy'): ArmyComp {
  const comp: ArmyComp = { piyade: 0, okcu: 0, suvari: 0, topcu: 0 }
  units.filter(u => u.side === side && !u.dead && !u.routing).forEach(u => {
    if (u.hp < 35) return
    comp[u.type] = (comp[u.type] ?? 0) + 1
  })
  return comp
}
