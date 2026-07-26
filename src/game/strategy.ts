import type { ArmyComp, Faction, GameState, Province, TaxLevel, Terrain } from './types'

const P = (id: string, name: string, x: number, y: number, owner: string, gold: number, food: number, terrain: Terrain, mp: number, adj: string[], garrison: ArmyComp, isCapital = false): Province =>
  ({ id, name, x, y, owner, core: true, unrest: 0, terrain, manpower: mp, maxManpower: mp, gold, food, adj, garrison, isCapital })

export const TAX_MULT: Record<TaxLevel, number> = { dusuk: 0.6, orta: 1.0, yuksek: 1.5 }
export const TAX_APPROVAL: Record<TaxLevel, number> = { dusuk: 3, orta: 0, yuksek: -6 }

export function newGame(): GameState {
  const provinces: Record<string, Province> = {}
  const add = (p: Province) => { provinces[p.id] = p }
  add(P('merkez', 'Payitaht', 46, 55, 'player', 90, 6, 'duzluk', 6, ['ova', 'liman', 'dag', 'orman'], { piyade: 2, okcu: 1, suvari: 0 }, true))
  add(P('ova', 'Bereket Ovası', 34, 68, 'player', 55, 9, 'duzluk', 8, ['merkez', 'liman', 'guney'], { piyade: 1, okcu: 0, suvari: 0 }))
  add(P('liman', 'İnci Limanı', 58, 66, 'player', 75, 4, 'kiyi', 5, ['merkez', 'ova', 'dogu_kapi'], { piyade: 1, okcu: 1, suvari: 0 }))
  add(P('dag', 'Granit Dağı', 46, 36, 'kuzey', 70, 2, 'dag', 4, ['merkez', 'orman', 'buz', 'kuzey_kalesi'], { piyade: 1, okcu: 1, suvari: 0 }))
  add(P('buz', 'Buzul Topraklar', 34, 18, 'kuzey', 50, 2, 'dag', 3, ['dag', 'kuzey_kalesi'], { piyade: 1, okcu: 0, suvari: 0 }))
  add(P('kuzey_kalesi', 'Kuzey Kalesi', 58, 16, 'kuzey', 85, 3, 'dag', 5, ['dag', 'buz', 'orman'], { piyade: 2, okcu: 1, suvari: 1 }, true))
  add(P('dogu_kapi', 'Doğu Kapısı', 74, 58, 'han', 65, 3, 'col', 4, ['liman', 'col', 'han_merkez'], { piyade: 1, okcu: 1, suvari: 0 }))
  add(P('col', 'Kızıl Çöl', 86, 44, 'han', 45, 1, 'col', 3, ['dogu_kapi', 'han_merkez'], { piyade: 0, okcu: 1, suvari: 1 }))
  add(P('han_merkez', 'Han Sarayı', 88, 70, 'han', 90, 5, 'col', 5, ['dogu_kapi', 'col'], { piyade: 1, okcu: 1, suvari: 2 }, true))
  add(P('orman', 'Ulu Orman', 30, 44, 'bati', 60, 5, 'orman', 5, ['merkez', 'dag', 'bati_limani', 'kuzey_kalesi'], { piyade: 1, okcu: 1, suvari: 0 }))
  add(P('bati_limani', 'Batı Limanı', 14, 52, 'bati', 70, 4, 'kiyi', 5, ['orman', 'senato'], { piyade: 1, okcu: 0, suvari: 0 }))
  add(P('senato', 'Senato Şehri', 14, 30, 'bati', 85, 4, 'orman', 5, ['bati_limani'], { piyade: 2, okcu: 1, suvari: 0 }, true))
  add(P('guney', 'Güney Bozkırı', 34, 86, 'player', 40, 6, 'duzluk', 6, ['ova'], { piyade: 0, okcu: 0, suvari: 1 }))

  const factions: Record<string, Faction> = {
    player: { id: 'player', name: 'Aksaray Devleti', color: '#14b8a6', isPlayer: true, gold: 300, food: 20, army: { piyade: 3, okcu: 2, suvari: 1 }, armyLocation: 'merkez', alive: true, relation: 0, state: 'baris', tradeAgreement: false },
    kuzey: { id: 'kuzey', name: 'Kuzey Krallığı', color: '#ef4444', isPlayer: false, gold: 250, food: 15, army: { piyade: 2, okcu: 1, suvari: 1 }, armyLocation: 'kuzey_kalesi', alive: true, relation: -10, state: 'baris', tradeAgreement: false },
    han: { id: 'han', name: 'Doğu Hanlığı', color: '#a855f7', isPlayer: false, gold: 250, food: 15, army: { piyade: 1, okcu: 2, suvari: 2 }, armyLocation: 'han_merkez', alive: true, relation: 0, state: 'baris', tradeAgreement: false },
    bati: { id: 'bati', name: 'Batı Cumhuriyeti', color: '#22c55e', isPlayer: false, gold: 250, food: 15, army: { piyade: 3, okcu: 1, suvari: 0 }, armyLocation: 'senato', alive: true, relation: 5, state: 'baris', tradeAgreement: false },
    asi: { id: 'asi', name: 'İsyancılar', color: '#6b7280', isPlayer: false, gold: 0, food: 0, alive: true, relation: -100, state: 'savas', tradeAgreement: false },
  }
  return {
    turn: 1, provinces, factions, tax: 'orta', edict: 'none', approval: 60, stability: 70,
    mana: { idari: 30, diplomatik: 30, askeri: 30 },
    techs: { idari: 0, diplomatik: 0, askeri: 0 },
    laws: { serf_azadi: false, zorunlu_askerlik: false, serbest_ticaret: false },
    groups: { halk: 60, soylular: 60, ordu: 60, tuccarlar: 60 },
    warScore: {}, armyXP: 0, coalitionFormed: false,
    log: ['Devlet kuruldu. Taht sizindir, hükümdarım!'],
  }
}

export const armySize = (a?: ArmyComp) => !a ? 0 : a.piyade + a.okcu + a.suvari + (a.topcu ?? 0)
export const armyPower = (a?: ArmyComp) => !a ? 0 : a.piyade * 10 + a.okcu * 9 + a.suvari * 14 + (a.topcu ?? 0) * 18

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const rand = (n: number) => Math.floor(Math.random() * n)

export function provinceIncome(_s: GameState, p: Province): { gold: number; food: number } {
  if (p.owner !== 'player' || p.occupiedBy) return { gold: 0, food: 0 }
  let gold = p.gold, food = p.food
  if (p.building === 'pazar') gold += 25
  if (p.building === 'ciftlik') food += 4
  if (!p.core) { gold = Math.round(gold * 0.3); food = Math.round(food * 0.5) }
  return { gold, food }
}

export function coreCost(s: GameState): number {
  return s.techs.idari >= 3 ? 9 : 15
}

function aiTakeTurn(s: GameState, f: Faction, log: string[]) {
  const provs = Object.values(s.provinces).filter(p => p.owner === f.id && !p.occupiedBy)
  if (Object.values(s.provinces).every(p => p.owner !== f.id)) { f.alive = false; return }
  f.gold += provs.reduce((t, p) => t + p.gold, 0)
  f.food += provs.reduce((t, p) => t + p.food, 0) - armySize(f.army)

  if (f.gold > 200 && f.army && armySize(f.army) < 12) {
    f.army.piyade += 1; f.gold -= 60
  }
  const player = s.factions.player
  if (f.state === 'baris') {
    f.relation = clamp(f.relation + rand(7) - 3 + (s.techs.diplomatik >= 3 ? 2 : 0) + (f.alliance ? 3 : 0), -100, 100)
    if (!f.alliance && f.relation < -50 && armyPower(f.army) > armyPower(player.army) * 1.1) {
      f.state = 'savas'
      s.warScore[f.id] = 0
      log.push(`⚔️ ${f.name} bize SAVAŞ İLAN ETTİ!`)
    }
  } else {
    if (f.army && f.armyLocation && armySize(f.army) > 2) {
      const cur = s.provinces[f.armyLocation]
      const target = cur.adj.map(a => s.provinces[a]).find(p => p.owner === 'player' && !p.occupiedBy)
      if (target) {
        if (target.id === player.armyLocation && armySize(player.army) > 0) {
          s.pendingBattle = { provinceId: target.id, attacker: f.id }
          log.push(`🔥 ${f.name} ordusu ${target.name} üzerine yürüyor!`)
        } else {
          const gpow = armyPower(target.garrison) + 15 + (target.terrain === 'dag' ? 20 : target.terrain === 'orman' ? 10 : 0)
          if (armyPower(f.army) > gpow) {
            target.owner = f.id
            target.core = false
            target.garrison = { piyade: 1, okcu: 0, suvari: 0 }
            f.army.piyade = Math.max(0, f.army.piyade - 1)
            s.warScore[f.id] = (s.warScore[f.id] ?? 0) - 20
            log.push(`💥 ${f.name}, ${target.name} eyaletini ELE GEÇİRDİ!`)
          } else {
            f.army.piyade = Math.max(0, f.army.piyade - 1)
            s.warScore[f.id] = (s.warScore[f.id] ?? 0) + 10
            log.push(`🛡️ ${target.name} garnizonu ${f.name} saldırısını püskürttü.`)
          }
        }
      } else {
        const next = cur.adj[rand(cur.adj.length)]
        f.armyLocation = next
      }
    }
    const score = s.warScore[f.id] ?? 0
    if ((score > 50 || armyPower(f.army) < 15) && Math.random() < 0.4) {
      f.state = 'baris'; f.relation = -20
      Object.values(s.provinces).forEach(p => { if (p.occupiedBy === 'player' && p.owner === f.id) p.occupiedBy = undefined })
      delete s.warScore[f.id]
      log.push(`🕊️ ${f.name} ağır kayıplar sonrası ateşkes istedi; işgal ettiğimiz topraklar iade edildi.`)
    }
  }
}

export const ARMY_LEVELS = [0, 20, 50, 90, 140, 200]
export function armyLevel(xp: number): number {
  let lvl = 0
  ARMY_LEVELS.forEach((th, i) => { if (xp >= th) lvl = i })
  return Math.min(5, lvl)
}

export const CHOICE_EVENTS: { id: string; title: string; text: string; options: { label: string; desc: string; apply: (s: GameState) => void }[] }[] = [
  {
    id: 'kultur_catismasi', title: '⚔️ Yeni Fetihlerde Kültür Çatışması',
    text: 'Yeni eyaletlerdeki halk geleneklerimizi reddediyor. Vezirler ikiye bölünmüş durumda.',
    options: [
      { label: 'Hoşgörü göster', desc: 'İsyan riski azalır, Halk memnun olur (🏛10)', apply: s => { if (s.mana.idari >= 10) { s.mana.idari -= 10; Object.values(s.provinces).forEach(p => { if (p.owner === 'player') p.unrest = Math.max(0, p.unrest - 15) }); s.groups.halk = clamp(s.groups.halk + 10, 0, 100) } } },
      { label: 'Sert yönetim dayat', desc: 'İstikrar +10 ama isyan riski artar', apply: s => { s.stability = clamp(s.stability + 10, 0, 100); Object.values(s.provinces).forEach(p => { if (p.owner === 'player' && !p.core) p.unrest = clamp(p.unrest + 15, 0, 100) }) } },
    ],
  },
  {
    id: 'yabanci_tuccar', title: '💼 Yabancı Tüccar Teklifi',
    text: 'Uzun yol tüccarı gizli güzergah haritasını satmayı teklif ediyor.',
    options: [
      { label: 'Haritayı satın al (💰80)', desc: 'Tüccarlar sevinir, +10 🕊', apply: s => { if (s.factions.player.gold >= 80) { s.factions.player.gold -= 80; s.mana.diplomatik = clamp(s.mana.diplomatik + 10, 0, 150); s.groups.tuccarlar = clamp(s.groups.tuccarlar + 10, 0, 100) } } },
      { label: 'Reddet', desc: 'Hiçbir şey olmaz', apply: () => {} },
    ],
  },
  {
    id: 'ordu_isyani', title: '🎖 Subayların Talebi',
    text: 'Subaylar maaş zammı istiyor, aksi halde disiplin sarsılacak.',
    options: [
      { label: 'Zam ver (💰60)', desc: 'Ordu +15, askeri nüfuz +5', apply: s => { if (s.factions.player.gold >= 60) { s.factions.player.gold -= 60; s.groups.ordu = clamp(s.groups.ordu + 15, 0, 100); s.mana.askeri = clamp(s.mana.askeri + 5, 0, 150) } } },
      { label: 'Karşı çık', desc: 'Ordu -20 memnuniyet', apply: s => { s.groups.ordu = clamp(s.groups.ordu - 20, 0, 100) } },
    ],
  },
  {
    id: 'soylu_komplo', title: '🤴 Soylu Komplosu',
    text: 'Bir soylunun sarayda entrika çevirdiği ortaya çıktı.',
    options: [
      { label: 'Affet', desc: 'Soylular +15, istikrar -5', apply: s => { s.groups.soylular = clamp(s.groups.soylular + 15, 0, 100); s.stability = clamp(s.stability - 5, 0, 100) } },
      { label: 'Sürgün et', desc: 'Soylular -15, istikrar +8 (🏛10)', apply: s => { if (s.mana.idari >= 10) { s.mana.idari -= 10; s.groups.soylular = clamp(s.groups.soylular - 15, 0, 100); s.stability = clamp(s.stability + 8, 0, 100) } } },
    ],
  },
  {
    id: 'koylu_ayaklanmasi', title: '👨‍🌾 Köylü Ayaklanması',
    text: 'Ağır vergilerden bıkan köylüler sokaklara döküldü.',
    options: [
      { label: 'Vergi indirimi sözü ver', desc: 'Halk +15, hazine -50 altın', apply: s => { s.groups.halk = clamp(s.groups.halk + 15, 0, 100); s.factions.player.gold = Math.max(0, s.factions.player.gold - 50) } },
      { label: 'Orduyu gönder', desc: 'Halk -15, istikrar +5, askeri nüfuz +5', apply: s => { s.groups.halk = clamp(s.groups.halk - 15, 0, 100); s.stability = clamp(s.stability + 5, 0, 100); s.mana.askeri = clamp(s.mana.askeri + 5, 0, 150) } },
    ],
  },
]

export function applyEventChoice(s: GameState, optionIndex: number): void {
  const ev = s.pendingEvent
  if (!ev) return
  const def = CHOICE_EVENTS.find(e => e.id === ev.id)
  const opt = def?.options[optionIndex]
  if (opt) {
    opt.apply(s)
    s.log = [`📜 ${ev.title} — Karar: ${opt.label}`, ...s.log]
  }
  s.pendingEvent = undefined
}

const EVENTS: { text: string; effect: (s: GameState) => string }[] = [
  { text: 'Bereketli hasat!', effect: s => { s.factions.player.food += 8; return '+8 erzak' } },
  { text: 'Tüccar kervanı vergi ödedi.', effect: s => { s.factions.player.gold += 60; return '+60 altın' } },
  { text: 'Veba salgını korkusu yayılıyor.', effect: s => { s.approval -= 5; s.groups.halk -= 5; return '-5 memnuniyet' } },
  { text: 'Ünlü bir kumandan ordunuza katıldı.', effect: s => { if (s.factions.player.army) s.factions.player.army.suvari += 1; return '+1 süvari birliği' } },
  { text: 'Diplomatlar sarayda ağırlandı.', effect: s => { s.mana.diplomatik = clamp(s.mana.diplomatik + 10, 0, 150); return '+10 diplomatik nüfuz' } },
  { text: 'Madende yeni damar bulundu!', effect: s => { s.factions.player.gold += 40; return '+40 altın' } },
  { text: 'Yeni bir vezir atandı.', effect: s => { s.mana.idari = clamp(s.mana.idari + 10, 0, 150); return '+10 idari nüfuz' } },
  { text: 'Gençler askere yazılmak için sıraya girdi.', effect: s => { s.mana.askeri = clamp(s.mana.askeri + 10, 0, 150); return '+10 askeri nüfuz' } },
  { text: 'Halk yüksek fiyatlardan şikayetçi.', effect: s => { s.stability -= 4; return '-4 istikrar' } },
]

export function endTurn(s: GameState): GameState {
  const ns: GameState = JSON.parse(JSON.stringify(s))
  ns.turn += 1
  const log: string[] = []
  const player = ns.factions.player
  const owned = Object.values(ns.provinces).filter(p => p.owner === 'player' && !p.occupiedBy)
  const occupiedByUs = Object.values(ns.provinces).filter(p => p.occupiedBy === 'player')

  const taxMult = TAX_MULT[ns.tax] * (ns.techs.idari >= 1 ? 1.1 : 1)
  let income = Math.round(owned.reduce((t, p) => t + provinceIncome(ns, p).gold, 0) * taxMult)
  if (ns.laws.serbest_ticaret) income += 15
  const foodProd = owned.reduce((t, p) => t + provinceIncome(ns, p).food, 0) + (ns.edict === 'tahil_ambari' ? 4 : 0) + (ns.laws.serf_azadi ? 2 : 0)
  const foodCost = armySize(player.army) + owned.reduce((t, p) => t + armySize(p.garrison), 0) * 0.5
  const tradeCount = Object.values(ns.factions).filter(f => !f.isPlayer && f.alive && f.tradeAgreement && f.state === 'baris').length
  const tradeBonus = tradeCount * (25 + (ns.techs.diplomatik >= 2 ? 15 : 0))
  if (ns.groups.tuccarlar >= 70) income = Math.round(income * 1.15)
  player.gold += income + tradeBonus
  player.food += Math.round(foodProd - foodCost)
  log.push(`💰 Gelir: +${income + tradeBonus} altın${tradeBonus ? ` (ticaret ${tradeBonus})` : ''}`)
  if (player.food < 0) { player.food = 0; ns.stability -= 8; ns.groups.halk -= 10; log.push('🌾 KITLIK! Erzak bitti, istikrar sarsıldı.') }

  const atWar = Object.values(ns.factions).some(f => !f.isPlayer && f.alive && f.state === 'savas')
  ns.mana.idari = clamp(ns.mana.idari + 5 + (ns.groups.soylular >= 70 ? 2 : 0), 0, 150)
  ns.mana.diplomatik = clamp(ns.mana.diplomatik + 5, 0, 150)
  ns.mana.askeri = clamp(ns.mana.askeri + 5 + (ns.groups.ordu >= 70 ? 2 : 0) + (atWar ? 2 : 0), 0, 150)

  const g = ns.groups
  g.halk = clamp(g.halk + TAX_APPROVAL[ns.tax] * 2 + (ns.edict === 'panayir' ? 8 : 0) + (atWar ? -2 : 1), 0, 100)
  g.soylular = clamp(g.soylular + (ns.tax === 'yuksek' ? 1 : 0) + (owned.length >= 6 ? 1 : 0), 0, 100)
  g.ordu = clamp(g.ordu + (atWar ? 2 : -1) + (armySize(player.army) < 4 ? -3 : 1), 0, 100)
  g.tuccarlar = clamp(g.tuccarlar + tradeCount * 2 - (atWar ? 2 : 0), 0, 100)
  if (ns.laws.serf_azadi) { g.halk = clamp(g.halk + 2, 0, 100); g.soylular = clamp(g.soylular - 2, 0, 100) }
  if (ns.laws.zorunlu_askerlik) { g.ordu = clamp(g.ordu + 2, 0, 100); g.halk = clamp(g.halk - 1, 0, 100) }
  if (ns.laws.serbest_ticaret) { g.tuccarlar = clamp(g.tuccarlar + 2, 0, 100); g.soylular = clamp(g.soylular - 1, 0, 100) }
  ;(Object.keys(g) as (keyof typeof g)[]).forEach(k => { if (g[k] < 50) g[k] = clamp(g[k] + 3, 0, 100) })
  const unhappy = Object.values(g).filter(v => v < 30).length
  if (unhappy > 0) { ns.stability -= unhappy * 3; log.push('😡 Memnuniyetsiz gruplar devleti içten kemiriyor!') }

  ns.approval = clamp(ns.approval + TAX_APPROVAL[ns.tax] + (ns.edict === 'panayir' ? 5 : 0) + (g.halk - 50) / 10, 0, 100)
  ns.stability = clamp(ns.stability + (ns.approval >= 50 ? 2 : -3) + (ns.edict === 'panayir' ? 2 : 0), 0, 100)
  if (ns.edict === 'askeri_seferberlik') player.gold += 20
  if (ns.approval < 25) { ns.stability -= 5; log.push('😡 Halk hoşnutsuz!') }
  if (ns.stability <= 10) { player.gold = Math.round(player.gold * 0.85); log.push('🔥 İç karışıklık hazinenizi yağmalattı!') }

  const uncoredCount = Object.values(ns.provinces).filter(p => p.owner === 'player' && !p.core).length
  const overextension = Math.max(0, uncoredCount - 3)
  owned.forEach(p => {
    const regen = 1 + (ns.laws.zorunlu_askerlik ? 1 : 0) + (ns.techs.askeri >= 2 ? 1 : 0) + (p.building === 'kosla' ? 1 : 0)
    p.manpower = Math.min(p.maxManpower + (p.building === 'kosla' ? 2 : 0), p.manpower + regen)
    let du = 0
    if (!p.core) du += 3
    du += overextension
    if (p.building === 'tapinak') du -= 5
    if (p.core) du -= 3
    p.unrest = clamp(p.unrest + du, 0, 100)
    if (p.unrest >= 100) {
      p.owner = 'asi'
      p.core = true
      p.unrest = 40
      p.garrison = { piyade: 2, okcu: 1, suvari: 0 }
      log.push(`🔥 İSYAN! ${p.name} devletten koptu!`)
    } else if (p.unrest > 70) {
      log.push(`⚠️ ${p.name} kaynıyor! (isyan riski %${p.unrest})`)
    }
    if (p.garrison.piyade < 2 && player.gold >= 40 && Math.random() < 0.5) { p.garrison.piyade += 1; player.gold -= 40 }
  })
  if (occupiedByUs.length > 0) log.push(`🏴 ${occupiedByUs.length} düşman eyaleti işgalimiz altında — barış masasında ilhak edilebilir.`)

  if (Math.random() < 0.5) {
    const ev = EVENTS[rand(EVENTS.length)]
    log.push(`📜 Olay: ${ev.text} (${ev.effect(ns)})`)
  }

  const playerProvCount = Object.values(ns.provinces).filter(p => p.owner === 'player').length
  if (!ns.coalitionFormed && playerProvCount >= 7) {
    ns.coalitionFormed = true
    const enemies = Object.values(ns.factions).filter(f => !f.isPlayer && f.id !== 'asi' && f.alive && !f.alliance)
    enemies.forEach(f => {
      if (f.state === 'baris') { f.state = 'savas'; s.warScore[f.id] = 0 }
      f.relation = clamp(f.relation - 50, -100, 100)
      f.tradeAgreement = false
    })
    if (enemies.length > 0) log.push('🔥 KOALİSYON! Genişlemenizden korkan devletler size karşı birleşti!')
  }

  if (!ns.pendingEvent && Math.random() < 0.3) {
    const ev = CHOICE_EVENTS[rand(CHOICE_EVENTS.length)]
    ns.pendingEvent = { id: ev.id, title: ev.title, text: ev.text, options: ev.options.map(o => ({ label: o.label, desc: o.desc })) }
  }

  Object.values(ns.factions).filter(f => !f.isPlayer && f.alive && f.id !== 'asi').forEach(f => aiTakeTurn(ns, f, log))

  ns.stability = clamp(ns.stability, 0, 100)
  ns.edict = 'none'
  ns.log = [...log.reverse(), ...ns.log].slice(0, 50)

  if (!Object.values(ns.provinces).some(p => p.owner === 'player')) ns.gameOver = 'lose'
  if (!Object.values(ns.provinces).some(p => p.owner !== 'player')) ns.gameOver = 'win'
  return ns
}
