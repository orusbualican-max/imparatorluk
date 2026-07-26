import { useState } from 'react'
import BattleScreen from '../components/BattleScreen'
import MapScreen from '../components/MapScreen'
import { createBattle, survivors } from '../game/battle'
import type { BattleUnit } from '../game/battle'
import { applyEventChoice, armyLevel, armySize, coreCost, endTurn, newGame } from '../game/strategy'
import { playMusic, sfx, stopMusic } from '../game/audio'
import { UNIT_INFO, BUILDING_INFO, LAW_INFO, TECH_INFO, DEFAULT_BANNER } from '../game/types'
import type { BannerDesign, Building, Edict, GameState, Law, ManaType, TaxLevel, UnitType } from '../game/types'
import { BannerDesigner, BannerSVG, OrnateFrame } from '../components/Banner'

type Screen = 'menu' | 'map' | 'battle' | 'gameover'

interface BattleCtx {
  units: BattleUnit[]
  provinceId: string
  enemyFactionId: string
  defense: boolean
}

const TECH_COSTS = [25, 50, 80]

export default function Home() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [gs, setGs] = useState<GameState | null>(null)
  const [battle, setBattle] = useState<BattleCtx | null>(null)
  const [armyMoved, setArmyMoved] = useState(false)

  const SAVE_KEY = 'imparatorluk_save'
  const saveGame = (s: GameState) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)) } catch { /* */ } }

  const start = (stateName?: string, banner?: BannerDesign) => {
    try {
      const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
      const so = window.screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      if (el.requestFullscreen && so.lock) {
        el.requestFullscreen().then(() => so.lock!('landscape').catch(() => {})).catch(() => {})
      }
    } catch { /* yoksay */ }
    stopMusic()
    setGs(newGame(stateName, banner)); setScreen('map'); setArmyMoved(false)
    playMusic('/ses/harita_muzigi.mp3')
  }

  const continueGame = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const s = JSON.parse(raw) as GameState
        setGs(s); setScreen('map'); setArmyMoved(false)
        playMusic('/ses/harita_muzigi.mp3')
      }
    } catch { /* */ }
  }

  const update = (fn: (s: GameState) => void) => {
    setGs(prev => { if (!prev) return prev; const ns: GameState = JSON.parse(JSON.stringify(prev)); fn(ns); saveGame(ns); return ns })
  }

  // === ASKER TOPLAMA (manpower ile) ===
  const recruit = (t: UnitType) => update(s => {
    const p = s.factions.player
    const info = UNIT_INFO[t]
    const loc = p.armyLocation ? s.provinces[p.armyLocation] : null
    if (!loc || loc.owner !== 'player' || loc.occupiedBy) return
    if (p.gold >= info.cost && loc.manpower >= info.manpower && p.army) {
      p.gold -= info.cost
      loc.manpower -= info.manpower
      p.army[t]++
      s.log = [`🪖 1 ${info.name} birliği ${loc.name} eyaletinden orduya katıldı.`, ...s.log]
    }
  })

  // === BİNA İNŞASI (Vic3) ===
  const build = (provId: string, b: Building) => update(s => {
    const p = s.provinces[provId]
    const player = s.factions.player
    const cost = Math.round(BUILDING_INFO[b].cost * (s.techs.idari >= 2 ? 0.75 : 1))
    if (p.owner === 'player' && !p.occupiedBy && p.core && !p.building && player.gold >= cost) {
      player.gold -= cost
      p.building = b
      s.log = [`🏗 ${p.name} eyaletinde ${BUILDING_INFO[b].name} inşa edildi.`, ...s.log]
    }
  })

  // === ÇEKİRDEK (EU4) ===
  const core = (provId: string) => update(s => {
    const p = s.provinces[provId]
    const cost = coreCost(s)
    if (p.owner === 'player' && !p.core && s.mana.idari >= cost) {
      s.mana.idari -= cost
      p.core = true
      p.unrest = Math.max(0, p.unrest - 30)
      s.log = [`📜 ${p.name} devlete tam olarak bağlandı (çekirdek eyalet).`, ...s.log]
    }
  })

  // === KANUN (Vic3) ===
  const toggleLaw = (law: Law) => update(s => {
    const info = LAW_INFO[law]
    if (s.laws[law]) {
      s.laws[law] = false
      s.log = [`📜 ${info.name} kanunu yürürlükten kaldırıldı.`, ...s.log]
    } else if (s.mana.idari >= info.cost) {
      s.mana.idari -= info.cost
      s.laws[law] = true
      s.log = [`⚖️ YENİ KANUN: ${info.name} ilan edildi!`, ...s.log]
    }
  })

  // === GELİŞİM (tech) ===
  const research = (track: ManaType) => update(s => {
    const lvl = s.techs[track]
    if (lvl < 3 && s.mana[track] >= TECH_COSTS[lvl]) {
      s.mana[track] -= TECH_COSTS[lvl]
      s.techs[track]++
      s.log = [`💡 Gelişim: ${TECH_INFO[track].levels[lvl].name} keşfedildi!`, ...s.log]
    }
  })

  const chooseEvent = (i: number) => update(s => applyEventChoice(s, i))

  // Sancak değişince hizip rengini de senkronla (harita/diplomasi renkleri)
  const bannerChange = (d: BannerDesign) => update(s => {
    s.playerBanner = d
    s.factions.player.color = d.field
  })

  const setTax = (t: TaxLevel) => update(s => { s.tax = t })
  const edict = (e: Edict) => update(s => {
    const costs: Record<string, [ManaType, number]> = { panayir: ['idari', 20], askeri_seferberlik: ['askeri', 20], tahil_ambari: ['idari', 15] }
    const [m, cost] = costs[e]
    if (s.mana[m] >= cost && s.edict === 'none') {
      s.mana[m] -= cost; s.edict = e
      s.log = ['📜 Ferman ilan edildi!', ...s.log]
    }
  })

  // === DİPLOMASİ + BARIŞ MASASI (EU4) ===
  const diplomacy = (fid: string, action: 'hediye' | 'ticaret' | 'savas' | 'ittifak' | 'beyaz_baris' | 'galibiyet_barisi' | 'maglubiyet_barisi') => update(s => {
    const f = s.factions[fid]; const p = s.factions.player
    const clamp = (v: number) => Math.max(-100, Math.min(100, v))
    const score = s.warScore[fid] ?? 0
    if (action === 'hediye' && p.gold >= 50) {
      p.gold -= 50
      f.relation = clamp(f.relation + (s.techs.diplomatik >= 1 ? 30 : 15))
      s.log = [`🎁 ${f.name} devletine hediye gönderildi.`, ...s.log]
    } else if (action === 'ticaret' && !f.tradeAgreement && s.mana.diplomatik >= 20 && f.relation >= 0) {
      s.mana.diplomatik -= 20; f.tradeAgreement = true; f.relation = clamp(f.relation + 10)
      s.log = [`💱 ${f.name} ile ticaret anlaşması imzalandı!`, ...s.log]
    } else if (action === 'ittifak' && !f.alliance && f.relation >= 50 && s.mana.diplomatik >= 40 && f.state === 'baris') {
      s.mana.diplomatik -= 40; f.alliance = true; f.tradeAgreement = true; f.relation = clamp(f.relation + 20)
      s.log = [`🤝 İTTİFAK! ${f.name} ile askeri ittifak kuruldu — size savaş açmaz ve savunmanızda destek yollar.`, ...s.log]
    } else if (action === 'savas') {
      f.state = 'savas'; f.relation = clamp(f.relation - 40); f.tradeAgreement = false; f.alliance = false
      s.warScore[fid] = 0
      s.log = [`⚔️ ${f.name} devletine SAVAŞ İLAN EDİLDİ!`, ...s.log]
    } else if (action === 'beyaz_baris' && s.mana.diplomatik >= 10) {
      s.mana.diplomatik -= 10
      f.state = 'baris'; f.relation = clamp(f.relation - 10)
      Object.values(s.provinces).forEach(pr => { if (pr.occupiedBy === 'player' && pr.owner === fid) pr.occupiedBy = undefined })
      delete s.warScore[fid]
      s.log = [`🕊️ ${f.name} ile beyaz barış: işgal edilen topraklar iade edildi.`, ...s.log]
    } else if (action === 'galibiyet_barisi' && score >= 40 && s.mana.diplomatik >= 20) {
      s.mana.diplomatik -= 20
      const annexed = Object.values(s.provinces).filter(pr => pr.occupiedBy === 'player' && pr.owner === fid)
      annexed.forEach(pr => {
        pr.owner = 'player'; pr.occupiedBy = undefined; pr.core = false; pr.unrest = 50
        pr.garrison = { piyade: 1, okcu: 0, suvari: 0 }
      })
      const tribute = score * 2
      p.gold += tribute; f.gold = Math.max(0, f.gold - tribute)
      f.state = 'baris'; f.relation = clamp(f.relation - 40)
      delete s.warScore[fid]
      s.log = [`👑 GALİBİYET BARIŞI! ${annexed.length > 0 ? annexed.map(a => a.name).join(', ') + ' ilhak edildi. ' : ''}Tazminat: +${tribute} altın. Yeni eyaletleri çekirdeğe bağlamayı unutmayın!`, ...s.log]
      if (!Object.values(s.provinces).some(pr => pr.owner === fid)) {
        f.alive = false
        s.log = [`🏳️ ${f.name} haritadan silindi!`, ...s.log]
        if (!Object.values(s.provinces).some(pr => pr.owner !== 'player')) s.gameOver = 'win'
      }
    } else if (action === 'maglubiyet_barisi' && score <= -40 && p.gold >= 100) {
      p.gold -= 100
      f.state = 'baris'; f.relation = clamp(f.relation - 10)
      Object.values(s.provinces).forEach(pr => { if (pr.occupiedBy === 'player' && pr.owner === fid) pr.occupiedBy = undefined })
      delete s.warScore[fid]
      s.log = [`🏳️ ${f.name} ile ağır şartlarda barış yapıldı. Tazminat ödendi: -100 altın.`, ...s.log]
    }
  })

  // === ORDU HAREKETİ / SALDIRI ===
  const moveArmy = (provId: string) => {
    if (!gs || armyMoved) return
    const prov = gs.provinces[provId]
    const p = gs.factions.player
    const ours = prov.owner === 'player' || prov.occupiedBy === 'player'
    if (ours) {
      update(s => { s.factions.player.armyLocation = provId })
      setArmyMoved(true)
    } else if (gs.factions[prov.owner].state === 'savas' || prov.owner === 'asi') {
      const enemyFaction = gs.factions[prov.owner]
      const enemyComp = { ...prov.garrison }
      if (enemyFaction.armyLocation === provId && enemyFaction.army) {
        enemyComp.piyade += enemyFaction.army.piyade
        enemyComp.okcu += enemyFaction.army.okcu
        enemyComp.suvari += enemyFaction.army.suvari
      }
      const defBonus = prov.terrain === 'dag' ? 20 : prov.terrain === 'orman' ? 10 : 0
      const units = createBattle(p.army!, enemyComp, {
        defSide: 'enemy',
        defBonusHp: defBonus,
        playerDmgMult: (gs.techs.askeri >= 1 ? 1.15 : 1) + armyLevel(gs.armyXP) * 0.04,
        playerMoraleResist: gs.techs.askeri >= 3 ? 0.3 : 0,
      })
      playMusic('/ses/savas_muzigi.mp3')
      setBattle({ units, provinceId: provId, enemyFactionId: prov.owner, defense: false })
      setScreen('battle')
    }
  }

  const handleEndTurn = () => {
    if (!gs) return
    const ns = endTurn(gs)
    sfx('/ses/tur.mp3', 0.4)
    setGs(ns)
    saveGame(ns)
    setArmyMoved(false)
    if (ns.gameOver) { setScreen('gameover'); return }
    if (ns.pendingBattle) {
      const pb = ns.pendingBattle
      const f = ns.factions[pb.attacker]
      const prov = ns.provinces[pb.provinceId]
      const defComp = {
        piyade: (ns.factions.player.army?.piyade ?? 0) + prov.garrison.piyade,
        okcu: (ns.factions.player.army?.okcu ?? 0) + prov.garrison.okcu,
        suvari: (ns.factions.player.army?.suvari ?? 0) + prov.garrison.suvari,
      }
      const ally = Object.values(ns.factions).find(f => !f.isPlayer && f.alive && f.alliance && f.state === 'baris')
      if (ally) {
        defComp.piyade += 1; defComp.okcu += 1
        ns.log = [`🤝 Müttefikimiz ${ally.name} savunmaya destek birliği yolladı!`, ...ns.log]
      }
      const defBonus = prov.terrain === 'dag' ? 20 : prov.terrain === 'orman' ? 10 : 0
      const units = createBattle(defComp, f.army!, {
        defSide: 'player',
        defBonusHp: defBonus,
        playerDmgMult: (ns.techs.askeri >= 1 ? 1.15 : 1) + armyLevel(ns.armyXP) * 0.04,
        playerMoraleResist: ns.techs.askeri >= 3 ? 0.3 : 0,
      })
      playMusic('/ses/savas_muzigi.mp3')
      setBattle({ units, provinceId: pb.provinceId, enemyFactionId: pb.attacker, defense: true })
      ns.pendingBattle = undefined
      setScreen('battle')
    }
  }

  const finishBattle = (units: BattleUnit[], winner: 'player' | 'enemy') => {
    if (!gs || !battle) return
    const enemyDead = units.filter(u => u.side === 'enemy' && u.dead).length
    sfx(winner === 'player' ? '/ses/zafer.mp3' : '/ses/yenilgi.mp3', 0.6)
    playMusic('/ses/harita_muzigi.mp3')
    update(s => {
      const prov = s.provinces[battle.provinceId]
      const enemyF = s.factions[battle.enemyFactionId]
      const mySurv = survivors(units, 'player')
      const enemySurv = survivors(units, 'enemy')
      if (battle.defense) {
        if (winner === 'player') {
          s.factions.player.army = mySurv
          prov.garrison = { piyade: Math.min(1, mySurv.piyade), okcu: 0, suvari: 0 }
          enemyF.army = enemySurv
          s.warScore[battle.enemyFactionId] = (s.warScore[battle.enemyFactionId] ?? 0) + 15
          s.log = [`🏆 ${prov.name} savunuldu!`, ...s.log]
        } else {
          prov.owner = battle.enemyFactionId
          prov.core = false
          prov.garrison = enemySurv.piyade + enemySurv.okcu + enemySurv.suvari > 0 ? enemySurv : { piyade: 1, okcu: 0, suvari: 0 }
          s.factions.player.army = mySurv
          const retreat = prov.adj.map(a => s.provinces[a]).find(a => a.owner === 'player' && !a.occupiedBy)
          s.factions.player.armyLocation = retreat ? retreat.id : undefined
          enemyF.armyLocation = prov.id
          enemyF.army = enemySurv
          s.warScore[battle.enemyFactionId] = (s.warScore[battle.enemyFactionId] ?? 0) - 20
          s.log = [`💥 ${prov.name} düştü! Ordumuz geri çekildi.`, ...s.log]
          if (!Object.values(s.provinces).some(pr => pr.owner === 'player')) s.gameOver = 'lose'
        }
      } else {
        if (winner === 'player') {
          if (battle.enemyFactionId === 'asi') {
            prov.owner = 'player'; prov.core = false; prov.unrest = 40
            s.log = [`🏆 İsyancılar ezildi, ${prov.name} geri alındı!`, ...s.log]
          } else {
            // AI ile eşit kural: savaşta alınan eyalet doğrudan ilhak edilir
            prov.owner = 'player'; prov.occupiedBy = undefined; prov.core = false
            prov.unrest = Math.max(prov.unrest, 50)
            s.warScore[battle.enemyFactionId] = (s.warScore[battle.enemyFactionId] ?? 0) + 20
            s.log = [`🏆 ZAFER! ${prov.name} ilhak edildi! Çekirdeğe bağlamayı unutmayın.`, ...s.log]
            if (!Object.values(s.provinces).some(pr => pr.owner === battle.enemyFactionId)) {
              enemyF.alive = false
              enemyF.state = 'baris'
              delete s.warScore[battle.enemyFactionId]
              s.log = [`🏳️ ${enemyF.name} haritadan silindi!`, ...s.log]
              if (!Object.values(s.provinces).some(pr => pr.owner !== 'player')) s.gameOver = 'win'
            }
          }
          prov.garrison = { piyade: 0, okcu: 0, suvari: 0 }
          s.factions.player.army = mySurv
          s.factions.player.armyLocation = prov.id
          if (enemyF.armyLocation === prov.id) { enemyF.army = enemySurv; enemyF.armyLocation = undefined }
          s.stability = Math.min(100, s.stability + 3)
        } else {
          s.factions.player.army = mySurv
          prov.garrison = enemySurv.piyade + enemySurv.okcu + enemySurv.suvari > 0 ? enemySurv : prov.garrison
          if (battle.enemyFactionId !== 'asi') s.warScore[battle.enemyFactionId] = (s.warScore[battle.enemyFactionId] ?? 0) - 15
          s.log = [`💀 ${prov.name} saldırısı başarısız oldu.`, ...s.log]
        }
      }
      s.armyXP += enemyDead
      const newLvl = armyLevel(s.armyXP)
      if (newLvl > armyLevel(s.armyXP - enemyDead)) {
        s.log = [`🎖 ORDUMUZ SEVİYE ATLADI! Seviye ${newLvl} — tüm birlikler +%${newLvl * 4} hasar!`, ...s.log]
      }
      if (armySize(s.factions.player.army) === 0 && !s.gameOver) {
        s.log = ['⚠️ Seyyar ordumuz yok oldu! Payitahtta yeni ordu toplayın.', ...s.log]
        s.factions.player.army = { piyade: 1, okcu: 0, suvari: 0 }
        s.factions.player.armyLocation = Object.values(s.provinces).find(pr => pr.owner === 'player' && pr.isCapital)?.id
      }
    })
    setArmyMoved(true)
    setBattle(null)
    setScreen('map')
    setGs(prev => { if (prev?.gameOver) setScreen('gameover'); return prev })
  }

  if (screen === 'menu') return <Menu onStart={start} onContinue={continueGame} hasSave={(() => { try { return !!localStorage.getItem(SAVE_KEY) } catch { return false } })()} />
  if (screen === 'battle' && battle && gs) {
    return <BattleScreen initialUnits={battle.units} provinceName={gs.provinces[battle.provinceId].name}
      enemyName={gs.factions[battle.enemyFactionId]?.name ?? 'İsyancılar'} banner={gs.playerBanner ?? DEFAULT_BANNER} onFinish={finishBattle} />
  }
  if (screen === 'gameover' && gs) {
    try { localStorage.removeItem(SAVE_KEY) } catch { /* */ }
    return (
      <div className="min-h-full bg-slate-950 text-white flex items-center justify-center p-4 relative">
        <img src="/img/menu_bg2.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="relative max-w-sm w-full bg-slate-900/80 border border-amber-800/50 rounded-2xl p-6 pt-8 text-center backdrop-blur-sm">
          <OrnateFrame />
          <BannerSVG d={gs.playerBanner ?? DEFAULT_BANNER} className="w-24 h-16 mx-auto mb-3 drop-shadow-xl" />
          <div className="text-6xl mb-4">{gs.gameOver === 'win' ? '👑' : '🏳️'}</div>
          <h1 className="text-3xl font-bold mb-2">{gs.gameOver === 'win' ? 'İMPARATORLUĞUNUZ EZELİ!' : 'Taht El Değiştirdi'}</h1>
          <p className="text-slate-400 mb-6">{gs.gameOver === 'win'
            ? `${gs.turn} turda tüm diyarı tek sancak altında birleştirdiniz. Tarih sizi hatırlayacak.`
            : `Devletiniz ${gs.turn}. turda yıkıldı. Belki bir sonraki hükümdar daha talihli olur.`}</p>
          <button onClick={() => { stopMusic(); setScreen('menu') }} className="px-8 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold">Ana Menüye Dön</button>
        </div>
      </div>
    )
  }
  if (!gs) return null
  return (
    <div className="h-full relative">
      <MapScreen gs={gs} onEndTurn={handleEndTurn} onRecruit={recruit} onMoveArmy={moveArmy}
        onSetTax={setTax} onEdict={edict} onDiplomacy={diplomacy}
        onBuild={build} onCore={core} onToggleLaw={toggleLaw} onResearch={research} onBannerChange={bannerChange} />
      {gs.pendingEvent && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-30">
          <div className="relative bg-slate-900 border-2 border-amber-700/80 rounded-2xl max-w-md w-full overflow-visible shadow-2xl shadow-black">
            <OrnateFrame />
            {/* EU4 tarzı olay tablosu */}
            {gs.pendingEvent.img && (
              <div className="relative border-b-2 border-amber-700/80 rounded-t-2xl overflow-hidden">
                <img src={gs.pendingEvent.img} alt="" className="w-full h-44 sm:h-52 object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent" />
                <div className="absolute bottom-2.5 left-4 right-4 text-lg font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">{gs.pendingEvent.title}</div>
              </div>
            )}
            <div className="p-5">
              {!gs.pendingEvent.img && <div className="text-lg font-bold mb-1">{gs.pendingEvent.title}</div>}
              <p className="text-sm text-slate-300 mb-4 italic">{gs.pendingEvent.text}</p>
              <div className="space-y-2">
                {gs.pendingEvent.options.map((o, i) => (
                  <button key={i} onClick={() => chooseEvent(i)}
                    className="w-full text-left rounded-xl bg-slate-800 border border-slate-600 hover:border-teal-500 p-3 transition">
                    <div className="font-bold text-sm">{o.label}</div>
                    <div className="text-xs text-slate-400">{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {armyMoved && (
        <div className="absolute bottom-24 right-3 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-xs text-slate-300 z-20">
          Ordu bu tur hareket etti
        </div>
      )}
    </div>
  )
}

function GoldDivider() {
  return (
    <div className="flex items-center gap-2 my-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/70 to-amber-500/70" />
      <img src="/img/orn_corner.png" alt="" className="w-5 h-5 opacity-80 rotate-45" />
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-500/70 to-amber-500/70" />
    </div>
  )
}

function Menu({ onStart, onContinue, hasSave }: { onStart: (name: string, banner: BannerDesign) => void; onContinue: () => void; hasSave: boolean }) {
  const [setup, setSetup] = useState(false)
  const [stateName, setStateName] = useState('Aksaray Devleti')
  const [banner, setBanner] = useState<BannerDesign>({ ...DEFAULT_BANNER })
  const [showDesigner, setShowDesigner] = useState(false)

  return (
    <div className="min-h-full bg-slate-950 text-white relative overflow-y-auto">
      <img src="/img/menu_bg2.jpg" alt="" className="fixed inset-0 w-full h-full object-cover" />
      <div className="fixed inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/25" />
      <div className="relative min-h-full flex flex-col items-center justify-center p-4 py-10">
        <div className="relative text-center max-w-lg w-full bg-slate-950/40 rounded-3xl border-2 border-amber-700/40 p-6 backdrop-blur-[2px] shadow-2xl shadow-black">
          <OrnateFrame />
          <div className="flex justify-center items-center gap-4 mb-4">
            <BannerSVG d={banner} className="w-14 h-10 drop-shadow-2xl hover:scale-110 transition-transform" />
            {['/img/banner_kuzey.png', '/img/banner_han.png', '/img/banner_bati.png'].map((b, i) => (
              <img key={i} src={b} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-2xl hover:scale-110 transition-transform" />
            ))}
          </div>
          <h1 className="text-5xl sm:text-6xl font-black mb-1 tracking-widest drop-shadow-lg">İMPARATORLUK</h1>
          <p className="text-amber-300/90 text-xs sm:text-sm tracking-wide font-semibold">DÖRT TAHT · TEK HÜKÜMDAR · SIRA TABANLI STRATEJİ & TAKTİK MUHAREBE</p>
          <GoldDivider />

          {!setup ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-left text-[11px] sm:text-xs mb-6">
                {[
                  ['/img/ic_siyaset.png', 'Devlet Yönetimi', 'Kanunlar, ilgi grupları, binalar, isyan riski'],
                  ['/img/ic_diplomasi.png', 'Diplomasi', 'İttifaklar, ticaret, savaş skoru, barış masası'],
                  ['/img/ic_askeri.png', 'Taktik Savaş', 'Sancaklı birlik kafileleri, moral, arazi, topçu'],
                  ['/img/ic_eyalet.png', 'Fetih', 'Üç devleti ortadan kaldır, diyarı birleştir'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="bg-slate-900/70 border border-amber-800/30 rounded-xl p-2.5 backdrop-blur-sm">
                    <div className="font-bold text-slate-100 flex items-center gap-1.5">
                      <img src={icon} alt="" className="w-5 h-5 object-contain" />{title}
                    </div>
                    <div className="text-slate-400 mt-0.5">{desc}</div>
                  </div>
                ))}
              </div>

              {hasSave && (
                <button onClick={onContinue}
                  className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-lg font-black active:scale-[0.98] transition shadow-lg shadow-amber-900/40 mb-3 flex items-center justify-center gap-2">
                  <img src="/img/ic_gunluk.png" alt="" className="w-6 h-6 object-contain" /> Kaldığın Yerden Devam Et
                </button>
              )}
              <button onClick={() => setSetup(true)}
                className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-lg font-black active:scale-[0.98] transition shadow-lg shadow-teal-900/50 flex items-center justify-center gap-2">
                <img src="/img/ic_askeri.png" alt="" className="w-6 h-6 object-contain" /> {hasSave ? 'Yeni Sefer' : 'Tahta Otur'}
              </button>
              <div className="text-[10px] text-slate-500 mt-4">v8.0 · Kayıt otomatik tutulur</div>
            </>
          ) : (
            <div className="text-left">
              <div className="text-center mb-4">
                <div className="text-xl font-black text-amber-200">Devletini Kur</div>
                <div className="text-[11px] text-slate-400">Adını yaz, sancağını dizayn et, tahta otur</div>
              </div>

              <div className="mb-4">
                <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Devlet Adı</div>
                <input value={stateName} onChange={e => setStateName(e.target.value.slice(0, 24))}
                  placeholder="Aksaray Devleti"
                  className="w-full rounded-xl bg-slate-900/80 border border-amber-700/50 px-4 py-3 text-center font-bold text-amber-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400" />
              </div>

              <div className="mb-5 flex items-center gap-4 bg-slate-900/70 border border-amber-800/30 rounded-xl p-3">
                <div className="relative flex-shrink-0">
                  <div className="w-1 h-16 bg-amber-900 rounded absolute -left-1 top-0" />
                  <BannerSVG d={banner} className="w-24 h-[70px] drop-shadow-2xl" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-slate-400 mb-2">Sancağın zemin rengi haritadaki toprak rengin olur.</div>
                  <button onClick={() => setShowDesigner(true)}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-black active:scale-[0.98] transition">
                    ⚑ Sancağı Dizayn Et
                  </button>
                </div>
              </div>

              <button onClick={() => onStart(stateName, banner)}
                className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-lg font-black active:scale-[0.98] transition shadow-lg shadow-teal-900/50 flex items-center justify-center gap-2">
                <img src="/img/ic_askeri.png" alt="" className="w-6 h-6 object-contain" /> {stateName.trim() || 'Aksaray Devleti'} ile Başla
              </button>
              <button onClick={() => setSetup(false)}
                className="w-full mt-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300">
                ← Geri Dön
              </button>
            </div>
          )}
        </div>
      </div>
      {showDesigner && (
        <BannerDesigner design={banner} onChange={setBanner} onClose={() => setShowDesigner(false)} />
      )}
    </div>
  )
}
