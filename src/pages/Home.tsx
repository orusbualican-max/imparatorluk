import { useState } from 'react'
import BattleScreen from '../components/BattleScreen'
import MapScreen from '../components/MapScreen'
import { createBattle, survivors } from '../game/battle'
import type { BattleUnit } from '../game/battle'
import { applyEventChoice, armyLevel, armySize, coreCost, endTurn, newGame } from '../game/strategy'
import { playMusic, sfx, stopMusic } from '../game/audio'
import { UNIT_INFO, BUILDING_INFO, LAW_INFO, TECH_INFO } from '../game/types'
import type { Building, Edict, GameState, Law, ManaType, TaxLevel, UnitType } from '../game/types'

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

  const start = () => {
    try {
      const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
      const so = window.screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
      if (el.requestFullscreen && so.lock) {
        el.requestFullscreen().then(() => so.lock!('landscape').catch(() => {})).catch(() => {})
      }
    } catch { /* yoksay */ }
    stopMusic()
    setGs(newGame()); setScreen('map'); setArmyMoved(false)
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

  const research = (track: ManaType) => update(s => {
    const lvl = s.techs[track]
    if (lvl < 3 && s.mana[track] >= TECH_COSTS[lvl]) {
      s.mana[track] -= TECH_COSTS[lvl]
      s.techs[track]++
      s.log = [`💡 Gelişim: ${TECH_INFO[track].levels[lvl].name} keşfedildi!`, ...s.log]
    }
  })

  const chooseEvent = (i: number) => update(s => applyEventChoice(s, i))

  const setTax = (t: TaxLevel) => update(s => { s.tax = t })
  const edict = (e: Edict) => update(s => {
    const costs: Record<string, [ManaType, number]> = { panayir: ['idari', 20], askeri_seferberlik: ['askeri', 20], tahil_ambari: ['idari', 15] }
    const [m, cost] = costs[e]
    if (s.mana[m] >= cost && s.edict === 'none') {
      s.mana[m] -= cost; s.edict = e
      s.log = ['📜 Ferman ilan edildi!', ...s.log]
    }
  })

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
            prov.occupiedBy = 'player'
            s.warScore[battle.enemyFactionId] = (s.warScore[battle.enemyFactionId] ?? 0) + 20
            s.log = [`🏆 ZAFER! ${prov.name} işgal edildi — ilhak için barış masasında talep edin.`, ...s.log]
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

  if (screen === 'menu') return <Menu onStart={start} onContinue={continueGame} />
  if (screen === 'battle' && battle && gs) {
    return <BattleScreen initialUnits={battle.units} provinceName={gs.provinces[battle.provinceId].name}
      enemyName={gs.factions[battle.enemyFactionId]?.name ?? 'İsyancılar'} onFinish={finishBattle} />
  }
  if (screen === 'gameover' && gs) {
    try { localStorage.removeItem(SAVE_KEY) } catch { /* */ }
    return (
      <div className="min-h-full bg-slate-950 text-white flex items-center justify-center p-4 relative">
        <img src="/img/menu_bg2.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="text-center max-w-sm relative">
          <div className="text-6xl mb-4">{gs.gameOver === 'win' ? '👑' : '🏳️'}</div>
          <h1 className="text-3xl font-bold mb-2">{gs.gameOver === 'win' ? 'İMPARATORLUĞUNUZ EZELİ!' : 'Taht El Değiştirdi'}</h1>
          <p className="text-slate-400 mb-6">{gs.gameOver === 'win'
            ? `${gs.turn} turda tüm diyarı tek sancak altında birleştirdiniz. Tarih sizi hatırlayacak.`
            : `Devletiniz ${gs.turn}. turda yıkıldı. Belki bir sonraki hükümdar daha talihli olur.`}</p>
          <button onClick={start} className="px-8 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold">Yeniden Başla</button>
        </div>
      </div>
    )
  }
  if (!gs) return null
  return (
    <div className="h-full relative">
      <MapScreen gs={gs} onEndTurn={handleEndTurn} onRecruit={recruit} onMoveArmy={moveArmy}
        onSetTax={setTax} onEdict={edict} onDiplomacy={diplomacy}
        onBuild={build} onCore={core} onToggleLaw={toggleLaw} onResearch={research} />
      {gs.pendingEvent && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-30">
          <div className="bg-slate-900 border border-amber-700 rounded-2xl p-5 max-w-md w-full">
            <div className="text-lg font-bold mb-1">{gs.pendingEvent.title}</div>
            <p className="text-sm text-slate-300 mb-4">{gs.pendingEvent.text}</p>
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
      )}
      {armyMoved && (
        <div className="absolute bottom-24 right-3 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1 text-xs text-slate-300 z-20">
          Ordu bu tur hareket etti
        </div>
      )}
    </div>
  )
}

function Menu({ onStart, onContinue }: { onStart: () => void; onContinue: () => void }) {
  const hasSave = (() => { try { return !!localStorage.getItem('imparatorluk_save') } catch { return false } })()
  const banners = ['/img/banner_player.png', '/img/banner_kuzey.png', '/img/banner_han.png', '/img/banner_bati.png']
  return (
    <div className="min-h-full bg-slate-950 text-white relative overflow-y-auto">
      <img src="/img/menu_bg2.jpg" alt="" className="fixed inset-0 w-full h-full object-cover" />
      <div className="fixed inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/25" />
      <div className="relative min-h-full flex flex-col items-center justify-center p-4 py-10">
        <div className="text-center max-w-lg w-full">
          <div className="flex justify-center gap-4 mb-4">
            {banners.map((b, i) => (
              <img key={i} src={b} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-2xl hover:scale-110 transition-transform" />
            ))}
          </div>
          <h1 className="text-5xl sm:text-6xl font-black mb-1 tracking-widest drop-shadow-lg">İMPARATORLUK</h1>
          <p className="text-amber-300/90 text-xs sm:text-sm mb-8 tracking-wide font-semibold">DÖRT TAHT · TEK HÜKÜMDAR · SIRA TABANLI STRATEJİ & TAKTİK MUHAREBE</p>

          <div className="grid grid-cols-2 gap-2 text-left text-[11px] sm:text-xs mb-8">
            {[
              ['🏛', 'Devlet Yönetimi', 'Kanunlar, ilgi grupları, binalar, isyan riski'],
              ['🤝', 'Diplomasi', 'İttifaklar, ticaret, savaş skoru, barış masası'],
              ['⚔️', 'Taktik Savaş', 'Sancaklı birlik kafileleri, moral, arazi, topçu'],
              ['👑', 'Fetih', 'Üç devleti ortadan kaldır, diyarı birleştir'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-2.5 backdrop-blur-sm">
                <div className="font-bold text-slate-100">{icon} {title}</div>
                <div className="text-slate-400 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>

          {hasSave && (
            <button onClick={onContinue}
              className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-lg font-black active:scale-[0.98] transition shadow-lg shadow-amber-900/40 mb-3">
              📜 Kaldığın Yerden Devam Et
            </button>
          )}
          <button onClick={onStart}
            className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-lg font-black active:scale-[0.98] transition shadow-lg shadow-teal-900/50">
            ⚔️ {hasSave ? 'Yeni Sefer' : 'Tahta Otur'}
          </button>
          <div className="text-[10px] text-slate-500 mt-4">v3.0 · Kayıt otomatik tutulur</div>
        </div>
      </div>
    </div>
  )
}
