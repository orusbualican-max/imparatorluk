import { useMemo, useState } from 'react'
import { Delaunay } from 'd3-delaunay'
import { UNIT_INFO, BUILDING_INFO, LAW_INFO, GROUP_INFO, TECH_INFO, TERRAIN_INFO } from '../game/types'
import type { Building, Faction, GameState, Law, ManaType, UnitType } from '../game/types'
import { ARMY_LEVELS, TAX_APPROVAL, armyLevel, armyPower, armySize, coreCost, provinceIncome } from '../game/strategy'

interface Props {
  gs: GameState
  onEndTurn: () => void
  onRecruit: (t: UnitType) => void
  onMoveArmy: (provinceId: string) => void
  onSetTax: (t: 'dusuk' | 'orta' | 'yuksek') => void
  onEdict: (e: 'panayir' | 'askeri_seferberlik' | 'tahil_ambari') => void
  onDiplomacy: (factionId: string, action: 'hediye' | 'ticaret' | 'savas' | 'ittifak' | 'beyaz_baris' | 'galibiyet_barisi' | 'maglubiyet_barisi') => void
  onBuild: (provId: string, b: Building) => void
  onCore: (provId: string) => void
  onToggleLaw: (law: Law) => void
  onResearch: (track: ManaType) => void
}

type Tab = 'eyalet' | 'diplomasi' | 'siyaset' | 'gelisim' | 'gunluk'

export const BANNER: Record<string, string> = {
  player: '/img/banner_player.png',
  kuzey: '/img/banner_kuzey.png',
  han: '/img/banner_han.png',
  bati: '/img/banner_bati.png',
  asi: '/img/banner_asi.png',
}
export const UNIT_IMG: Record<UnitType, string> = {
  piyade: '/img/unit_piyade.png',
  okcu: '/img/unit_okcu.png',
  suvari: '/img/unit_suvari.png',
  topcu: '/img/unit_topcu.png',
}

const Y = (y: number) => y * 0.62
const TECH_COSTS = [25, 50, 80]

export default function MapScreen(p: Props) {
  const { gs } = p
  const [tab, setTab] = useState<Tab>('eyalet')
  const [selProv, setSelProv] = useState<string | null>(gs.factions.player.armyLocation ?? null)
  const player = gs.factions.player
  const prov = selProv ? gs.provinces[selProv] : null
  const armyHere = prov && player.armyLocation === prov.id
  const ours = prov && (prov.owner === 'player' || prov.occupiedBy === 'player')
  const isAdj = prov && player.armyLocation ? gs.provinces[player.armyLocation].adj.includes(prov.id) : false

  const provList = Object.values(gs.provinces)
  const cells = useMemo(() => {
    const pts = provList.map(pr => [pr.x, Y(pr.y)] as [number, number])
    return Delaunay.from(pts).voronoi([0, 0, 100, 62])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cellPath = (i: number) => {
    const poly = cells.cellPolygon(i)
    if (!poly) return ''
    return 'M' + poly.map(pt => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join('L') + 'Z'
  }

  const res = (icon: string, v: number | string, warn = false) => (
    <div className={`flex items-center gap-0.5 text-[11px] sm:text-xs font-semibold ${warn ? 'text-red-400' : ''}`}>
      <span>{icon}</span><span>{v}</span>
    </div>
  )

  return (
    <div className="h-full relative bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Üst kaynak çubuğu */}
      <div className="bg-slate-900/95 border-b border-slate-700 px-2 py-1.5 flex items-center justify-between gap-1 flex-shrink-0 flex-wrap">
        <div className="font-bold text-xs flex items-center gap-1.5">
          <img src={BANNER.player} className="w-5 h-5 object-contain" alt="" />
          <span className="hidden sm:inline">{player.name}</span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {res('💰', player.gold)}
          {res('🌾', player.food, player.food < 5)}
          {res('🏛', gs.mana.idari)}
          {res('🕊', gs.mana.diplomatik)}
          {res('⚔', gs.mana.askeri)}
          {res('😊', `%${gs.approval}`, gs.approval < 30)}
          {res('🎚', `%${gs.stability}`, gs.stability < 30)}
          {res('📅', `T${gs.turn}`)}
        </div>
      </div>

      <div className="flex-1 flex flex-col landscape:flex-row min-h-0">
        {/* Harita */}
        <div className="relative h-[42%] landscape:h-auto landscape:flex-1 min-w-0 flex-shrink-0">
          <img src="/img/map_bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/20" />
          <svg viewBox="0 0 100 62" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
            {provList.map((pr, i) => {
              const f = gs.factions[pr.owner]
              const selected = pr.id === selProv
              return (
                <path key={'c' + pr.id} d={cellPath(i)}
                  fill={f?.color ?? '#666'} fillOpacity={selected ? 0.5 : 0.32}
                  stroke={selected ? '#fbbf24' : (f?.color ?? '#666')}
                  strokeWidth={selected ? 1 : 0.5}
                  strokeDasharray={pr.owner === 'player' && !pr.core ? '1.5,1' : undefined}
                  onClick={() => { setSelProv(pr.id); setTab('eyalet') }}
                  className="cursor-pointer" />
              )
            })}
            {provList.map((pr) => {
              const selected = pr.id === selProv
              const armyThere = player.armyLocation === pr.id
              const enemyArmy = Object.values(gs.factions).find(ef => !ef.isPlayer && ef.alive && ef.armyLocation === pr.id && armySize(ef.army) > 0)
              const py = Y(pr.y)
              const occupiedByUs = pr.occupiedBy === 'player'
              return (
                <g key={pr.id} onClick={() => { setSelProv(pr.id); setTab('eyalet') }} className="cursor-pointer">
                  {selected && <circle cx={pr.x} cy={py} r="5.5" fill="none" stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="1,0.8" />}
                  <image href={BANNER[pr.owner] ?? BANNER.asi} x={pr.x - 2.2} y={py - 3.4} width="4.4" height="4.4" />
                  {occupiedByUs && <image href={BANNER.player} x={pr.x + 1.8} y={py - 5.4} width="2.6" height="2.6" opacity="0.95" />}
                  {pr.isCapital && <text x={pr.x + 3.2} y={py - 1} fontSize="2.4" textAnchor="middle">⭐</text>}
                  {pr.unrest > 70 && <text x={pr.x - 4} y={py - 2} fontSize="2.6" textAnchor="middle">🔥</text>}
                  {armyThere && (
                    <g>
                      <circle cx={pr.x + 3.6} cy={py - 3.6} r="2" fill="#14b8a6" stroke="#0f172a" strokeWidth="0.4" />
                      <text x={pr.x + 3.6} y={py - 3} fontSize="2.4" textAnchor="middle">⚔</text>
                    </g>
                  )}
                  {enemyArmy && (
                    <g>
                      <circle cx={pr.x - 3.6} cy={py - 3.6} r="2" fill="#dc2626" stroke="#0f172a" strokeWidth="0.4" />
                      <text x={pr.x - 3.6} y={py - 3} fontSize="2.2" textAnchor="middle">⚔</text>
                    </g>
                  )}
                  <text x={pr.x} y={py + 5.5} fontSize="2.4" fill="#fff" textAnchor="middle" fontWeight="bold"
                    stroke="rgba(0,0,0,0.85)" strokeWidth="0.4" paintOrder="stroke">{pr.name}</text>
                  <text x={pr.x} y={py + 8.3} fontSize="1.9" fill="rgba(255,255,255,0.75)" textAnchor="middle"
                    stroke="rgba(0,0,0,0.7)" strokeWidth="0.25" paintOrder="stroke">{TERRAIN_INFO[pr.terrain].icon}</text>
                </g>
              )
            })}
          </svg>
          <div className="absolute top-1.5 right-2 flex gap-2 text-[10px] text-white bg-slate-950/60 rounded-lg px-2 py-1 backdrop-blur-sm">
            {Object.values(gs.factions).filter(f => f.alive).map(f => (
              <span key={f.id} className="flex items-center gap-1">
                <img src={BANNER[f.id] ?? BANNER.asi} className="w-3.5 h-3.5 object-contain" alt="" />{f.name}
              </span>
            ))}
          </div>
        </div>

        {/* Panel */}
        <div className="flex-1 landscape:flex-none landscape:w-[330px] xl:landscape:w-[370px] bg-slate-900 border-t landscape:border-t-0 landscape:border-l border-slate-700 flex flex-col min-h-0">
          <div className="flex border-b border-slate-700 flex-shrink-0">
            {([['eyalet', '🏰'], ['diplomasi', '🤝'], ['siyaset', '🏛'], ['gelisim', '💡'], ['gunluk', '📜']] as [Tab, string][]).map(([t, icon]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 text-[10px] sm:text-[11px] font-semibold ${tab === t ? 'bg-slate-800 text-teal-300 border-b-2 border-teal-400' : 'text-slate-400'}`}>
                {icon} <span className="hidden sm:inline">{{ eyalet: 'Eyalet', diplomasi: 'Diplomasi', siyaset: 'Siyaset', gelisim: 'Gelişim', gunluk: 'Günlük' }[t]}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 min-h-0">
            {tab === 'eyalet' && prov && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={BANNER[prov.owner] ?? BANNER.asi} className="w-8 h-8 object-contain" alt="" />
                    <div>
                      <div className="font-bold text-sm">{prov.name} {prov.isCapital && '⭐'}</div>
                      <div className="text-[11px] text-slate-400">{gs.factions[prov.owner]?.name ?? 'İsyancılar'} · {TERRAIN_INFO[prov.terrain].icon} {TERRAIN_INFO[prov.terrain].name}</div>
                    </div>
                  </div>
                </div>

                {prov.occupiedBy === 'player' && (
                  <div className="rounded-lg bg-amber-950/50 border border-amber-700 p-2 text-[11px] text-amber-200">
                    🏴 İşgalimiz altında — gelir üretmiyor. İlhak için barış masasında talep edin (Diplomasi).
                  </div>
                )}
                {prov.owner === 'player' && !prov.core && !prov.occupiedBy && (
                  <div className="rounded-lg bg-red-950/40 border border-red-800 p-2 space-y-1.5">
                    <div className="text-[11px] text-red-200">⚠️ Çekirdeksiz eyalet: gelirin sadece %30'unu üretiyor, isyan riski yüksek.</div>
                    <button onClick={() => p.onCore(prov.id)} disabled={gs.mana.idari < coreCost(gs)}
                      className="w-full py-1.5 rounded-lg bg-teal-700 text-xs font-bold disabled:opacity-40">
                      📜 Çekirdeğe Bağla (🏛{coreCost(gs)})
                    </button>
                  </div>
                )}
                {prov.unrest > 0 && prov.owner === 'player' && (
                  <div className="text-[11px]">
                    <span className={prov.unrest > 70 ? 'text-red-400 font-bold' : 'text-slate-400'}>İsyan riski: %{prov.unrest}</span>
                    <div className="h-1.5 rounded bg-slate-700 overflow-hidden mt-0.5">
                      <div className={`h-full ${prov.unrest > 70 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${prov.unrest}%` }} />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>Gelir: 💰{provinceIncome(gs, prov).gold} · 🌾{provinceIncome(gs, prov).food} /tur</div>
                  <div className="flex items-center gap-1">
                    Asker kaynağı: <b className="text-slate-200">{prov.manpower}/{prov.maxManpower + (prov.building === 'kosla' ? 2 : 0)}</b>
                    <span className="flex gap-0.5">
                      {Array.from({ length: prov.maxManpower + (prov.building === 'kosla' ? 2 : 0) }).map((_, i) => (
                        <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i < prov.manpower ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    Garnizon:
                    {(['piyade', 'okcu', 'suvari'] as UnitType[]).map(t => (
                      <span key={t} className="flex items-center gap-0.5">
                        <img src={UNIT_IMG[t]} className="w-4 h-4 rounded-full object-cover" alt="" />{prov.garrison[t]}
                      </span>
                    ))}
                  </div>
                  <div>Bina: {prov.building ? `${BUILDING_INFO[prov.building].icon} ${BUILDING_INFO[prov.building].name}` : '—'}</div>
                </div>

                {/* Bina inşası */}
                {prov.owner === 'player' && !prov.occupiedBy && prov.core && !prov.building && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300 mb-1">Bina İnşa Et {gs.techs.idari >= 2 && <span className="text-teal-400">(-%25)</span>}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(BUILDING_INFO) as Building[]).map(b => {
                        const cost = Math.round(BUILDING_INFO[b].cost * (gs.techs.idari >= 2 ? 0.75 : 1))
                        return (
                          <button key={b} onClick={() => p.onBuild(prov.id, b)} disabled={player.gold < cost}
                            className="rounded-lg bg-slate-800 border border-slate-600 p-1.5 text-[10px] disabled:opacity-40 active:scale-95 text-left">
                            <div className="font-bold">{BUILDING_INFO[b].icon} {BUILDING_INFO[b].name} <span className="text-amber-300">💰{cost}</span></div>
                            <div className="text-slate-400">{BUILDING_INFO[b].desc}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {armyHere && (
                  <div className="rounded-lg bg-teal-950/50 border border-teal-800 p-2">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-[11px] text-teal-300 font-semibold">Ordunuz burada</div>
                      <div className="text-[10px] text-amber-300 font-bold">🎖 Seviye {armyLevel(gs.armyXP)} (+%{armyLevel(gs.armyXP) * 4} hasar)</div>
                    </div>
                    <div className="h-1 rounded bg-slate-700 overflow-hidden mb-1.5">
                      <div className="h-full bg-amber-400" style={{ width: `${armyLevel(gs.armyXP) >= 5 ? 100 : ((gs.armyXP - ARMY_LEVELS[armyLevel(gs.armyXP)]) / (ARMY_LEVELS[armyLevel(gs.armyXP) + 1] - ARMY_LEVELS[armyLevel(gs.armyXP)])) * 100}%` }} />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {(['piyade', 'okcu', 'suvari', 'topcu'] as UnitType[]).map(t => (
                        <span key={t} className="flex items-center gap-1">
                          <img src={UNIT_IMG[t]} className="w-6 h-6 rounded-full object-cover border border-teal-600" alt="" />×{player.army![t] ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {prov.owner === 'player' && !prov.occupiedBy && armyHere && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300 mb-1">Asker Topla (eyaletin asker kaynağından)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(Object.keys(UNIT_INFO) as UnitType[]).map(t => (
                        <button key={t} onClick={() => p.onRecruit(t)}
                          disabled={player.gold < UNIT_INFO[t].cost || prov.manpower < UNIT_INFO[t].manpower}
                          className="rounded-lg bg-slate-800 border border-slate-600 p-1.5 text-[10px] disabled:opacity-40 active:scale-95 transition">
                          <img src={UNIT_IMG[t]} className="w-8 h-8 rounded-full object-cover mx-auto mb-0.5 border border-slate-500" alt="" />
                          <div className="font-bold">{UNIT_INFO[t].name}</div>
                          <div className="text-slate-400">💰{UNIT_INFO[t].cost} 👤{UNIT_INFO[t].manpower}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {ours && isAdj && !armyHere && (
                  <button onClick={() => p.onMoveArmy(prov.id)}
                    className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-sm">
                    🥾 Orduyu buraya yürüt
                  </button>
                )}
                {!ours && (
                  <div className="space-y-2">
                    {(gs.factions[prov.owner]?.state === 'savas' || prov.owner === 'asi') ? (
                      isAdj ? (
                        <button onClick={() => p.onMoveArmy(prov.id)}
                          className="w-full py-2.5 rounded-xl bg-red-700 hover:bg-red-600 font-bold text-sm">
                          ⚔️ SALDIR! (Muharebe başlar)
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-400">Saldırmak için ordunuz komşu eyalette olmalı.</div>
                      )
                    ) : (
                      <div className="text-[11px] text-amber-300">⚠️ {gs.factions[prov.owner]?.name} ile barış halindeyiz. Önce savaş ilan edin.</div>
                    )}
                    {prov.terrain !== 'duzluk' && (
                      <div className="text-[10px] text-slate-400">{TERRAIN_INFO[prov.terrain].icon} {TERRAIN_INFO[prov.terrain].desc}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'diplomasi' && (
              <div className="space-y-2.5">
                {Object.values(gs.factions).filter(f => !f.isPlayer && f.id !== 'asi').map(f => (
                  <FactionCard key={f.id} f={f} gs={gs} onAction={p.onDiplomacy} />
                ))}
              </div>
            )}

            {tab === 'siyaset' && (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">Vergi Oranı</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['dusuk', 'orta', 'yuksek'] as const).map(t => (
                      <button key={t} onClick={() => p.onSetTax(t)}
                        className={`rounded-lg p-1.5 text-[10px] border ${gs.tax === t ? 'border-teal-400 bg-teal-900/40' : 'border-slate-600 bg-slate-800'}`}>
                        <div className="font-bold">{t === 'dusuk' ? 'Düşük' : t === 'orta' ? 'Orta' : 'Yüksek'}</div>
                        <div className="text-slate-400">😊 {TAX_APPROVAL[t] > 0 ? '+' : ''}{TAX_APPROVAL[t]}/tur</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">Ferman (bu tur)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      ['panayir', '🎪 Panayır', 'idari', 20],
                      ['askeri_seferberlik', '⚔️ Seferberlik', 'askeri', 20],
                      ['tahil_ambari', '🌾 Ambar', 'idari', 15],
                    ] as const).map(([e, name, m, cost]) => (
                      <button key={e} onClick={() => p.onEdict(e)} disabled={gs.mana[m] < cost || gs.edict === e}
                        className="rounded-lg bg-slate-800 border border-slate-600 p-1.5 text-[10px] disabled:opacity-40 active:scale-95">
                        <div className="font-bold">{name}</div>
                        <div className="text-amber-300">{{ idari: '🏛', diplomatik: '🕊', askeri: '⚔' }[m as ManaType]}{cost}</div>
                        {gs.edict === e && <div className="text-teal-400">✅ Aktif</div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">Kanunlar (🏛{gs.mana.idari})</div>
                  <div className="space-y-1.5">
                    {(Object.keys(LAW_INFO) as Law[]).map(l => (
                      <button key={l} onClick={() => p.onToggleLaw(l)} disabled={!gs.laws[l] && gs.mana.idari < LAW_INFO[l].cost}
                        className={`w-full text-left rounded-lg border p-2 text-[10px] disabled:opacity-40 active:scale-[0.99] transition ${gs.laws[l] ? 'border-teal-500 bg-teal-950/40' : 'border-slate-600 bg-slate-800'}`}>
                        <div className="flex justify-between font-bold text-[11px]">
                          <span>{LAW_INFO[l].icon} {LAW_INFO[l].name}</span>
                          <span>{gs.laws[l] ? '✅ Yürürlükte (kaldır)' : `🏛${LAW_INFO[l].cost}`}</span>
                        </div>
                        <div className="text-slate-400">{LAW_INFO[l].effects}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-1">İlgi Grupları</div>
                  <div className="space-y-1">
                    {(Object.keys(GROUP_INFO) as (keyof typeof GROUP_INFO)[]).map(gid => {
                      const v = gs.groups[gid]
                      return (
                        <div key={gid} className="flex items-center gap-2 text-[10px]">
                          <span className="w-20 flex-shrink-0">{GROUP_INFO[gid].icon} {GROUP_INFO[gid].name}</span>
                          <div className="flex-1 h-2 rounded bg-slate-700 overflow-hidden">
                            <div className={`h-full ${v >= 70 ? 'bg-green-500' : v >= 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v}%` }} />
                          </div>
                          <span className={`w-7 text-right font-bold ${v < 30 ? 'text-red-400' : 'text-slate-300'}`}>{v}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Memnun gruplar (≥70) bonus verir; öfkeli gruplar (&lt;30) istikrarı sarsar.</div>
                </div>
              </div>
            )}

            {tab === 'gelisim' && (
              <div className="space-y-3">
                {(Object.keys(TECH_INFO) as ManaType[]).map(track => {
                  const lvl = gs.techs[track]
                  const done = lvl >= 3
                  return (
                    <div key={track} className="rounded-xl bg-slate-800 border border-slate-600 p-2">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="font-bold text-[11px]">{TECH_INFO[track].icon} {TECH_INFO[track].name}</div>
                        <div className="text-[10px] text-amber-300">{{ idari: '🏛', diplomatik: '🕊', askeri: '⚔' }[track]}{gs.mana[track]}</div>
                      </div>
                      <div className="space-y-1">
                        {TECH_INFO[track].levels.map((l, i) => (
                          <div key={i} className={`flex items-center justify-between rounded-lg p-1.5 text-[10px] ${i < lvl ? 'bg-teal-950/50 border border-teal-800' : i === lvl ? 'bg-slate-700' : 'bg-slate-800/50 opacity-50'}`}>
                            <div><b>{l.name}</b> — <span className="text-slate-400">{l.desc}</span></div>
                            {i < lvl ? <span className="text-teal-400 font-bold">✓</span> : i === lvl && !done ? (
                              <button onClick={() => p.onResearch(track)} disabled={gs.mana[track] < TECH_COSTS[i]}
                                className="px-2 py-1 rounded bg-amber-600 font-bold disabled:opacity-40 active:scale-95">
                                {TECH_COSTS[i]}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'gunluk' && (
              <div className="space-y-1">
                {gs.log.map((l, i) => (
                  <div key={i} className={`text-[11px] ${i === 0 ? 'text-white' : 'text-slate-400'}`}>{l}</div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-slate-700 flex-shrink-0">
            <button onClick={p.onEndTurn}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-sm active:scale-[0.98] transition">
              ⏭ Turu Bitir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FactionCard({ f, gs, onAction }: { f: Faction; gs: GameState; onAction: Props['onDiplomacy'] }) {
  const player = gs.factions.player
  const rel = f.relation
  const relColor = rel > 30 ? 'text-green-400' : rel > -20 ? 'text-slate-300' : 'text-red-400'
  const provCount = Object.values(gs.provinces).filter(pr => pr.owner === f.id).length
  const score = gs.warScore[f.id] ?? 0
  if (!f.alive || provCount === 0) return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3 opacity-50 text-xs flex items-center gap-2">
      <img src={BANNER[f.id]} className="w-6 h-6 object-contain grayscale" alt="" /> {f.name} — tarihe karıştı.
    </div>
  )
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-600 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-bold text-xs flex items-center gap-2">
          <img src={BANNER[f.id]} className="w-7 h-7 object-contain" alt="" />
          {f.name}
        </div>
        <span className="flex gap-1">
          {f.alliance && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-900 text-teal-200">🤝 Müttefik</span>}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${f.state === 'savas' ? 'bg-red-900 text-red-200' : 'bg-slate-700 text-slate-300'}`}>
            {f.state === 'savas' ? '⚔️ SAVAŞ' : '🕊️ Barış'}
          </span>
        </span>
      </div>
      <div className="text-[11px] text-slate-400">
        İlişki: <span className={relColor}>{rel > 0 ? '+' : ''}{rel}</span> · {provCount} eyalet · Güç: ~{armyPower(f.army)}
        {f.tradeAgreement && ' · 💱 Ticaret'}
      </div>

      {f.state === 'savas' && (
        <div>
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>Savaş Skoru</span>
            <span className={score >= 40 ? 'text-green-400 font-bold' : score <= -40 ? 'text-red-400 font-bold' : ''}>{score > 0 ? '+' : ''}{score}</span>
          </div>
          <div className="h-2 rounded bg-slate-700 overflow-hidden relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-500" />
            <div className={`h-full ${score >= 0 ? 'bg-teal-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, Math.abs(score)) / 2}%`, marginLeft: score >= 0 ? '50%' : `${50 - Math.min(100, Math.abs(score)) / 2}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {f.state === 'baris' ? (
          <>
            <button onClick={() => onAction(f.id, 'hediye')} disabled={player.gold < 50}
              className="rounded-lg bg-slate-700 p-1.5 text-[10px] disabled:opacity-40 active:scale-95">🎁 Hediye (💰50)</button>
            <button onClick={() => onAction(f.id, 'ticaret')} disabled={f.tradeAgreement || gs.mana.diplomatik < 20 || rel < 0}
              className="rounded-lg bg-slate-700 p-1.5 text-[10px] disabled:opacity-40 active:scale-95">💱 Ticaret (🕊20)</button>
            <button onClick={() => onAction(f.id, 'ittifak')} disabled={!!f.alliance || rel < 50 || gs.mana.diplomatik < 40}
              className="rounded-lg bg-teal-800 p-1.5 text-[10px] disabled:opacity-40 active:scale-95 col-span-2">
              🤝 {f.alliance ? 'Müttefiksiniz' : 'İttifak Kur (🕊40, ilişki 50+)'}
            </button>
            <button onClick={() => onAction(f.id, 'savas')}
              className="rounded-lg bg-red-800 p-1.5 text-[10px] active:scale-95 col-span-2">⚔️ Savaş İlan Et</button>
          </>
        ) : (
          <>
            <button onClick={() => onAction(f.id, 'beyaz_baris')} disabled={gs.mana.diplomatik < 10}
              className="rounded-lg bg-slate-700 p-1.5 text-[10px] disabled:opacity-40">🕊️ Beyaz Barış (🕊10)</button>
            <button onClick={() => onAction(f.id, 'galibiyet_barisi')} disabled={score < 40 || gs.mana.diplomatik < 20}
              className="rounded-lg bg-teal-700 p-1.5 text-[10px] disabled:opacity-40">👑 Galibiyet Barışı {score >= 40 ? '' : '(skor 40+)'}</button>
            {score <= -40 && (
              <button onClick={() => onAction(f.id, 'maglubiyet_barisi')} disabled={player.gold < 100}
                className="rounded-lg bg-red-900 p-1.5 text-[10px] disabled:opacity-40 col-span-2">🏳️ Teslim Ol (💰100 tazminat)</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
