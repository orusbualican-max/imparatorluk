import type { BannerDesign, BannerPattern } from '../game/types'
import { DEFAULT_BANNER } from '../game/types'

// === Seçenek listeleri ===
export const FIELD_COLORS = [
  ['#14b8a6', 'Turkuaz'], ['#dc2626', 'Kızıl'], ['#2563eb', 'Lacivert'], ['#16a34a', 'Yeşil'],
  ['#d97706', 'Amber'], ['#7c3aed', 'Mor'], ['#db2777', 'Pembe'], ['#0f172a', 'Siyah'],
  ['#f8fafc', 'Ak'], ['#78350f', 'Kahve'],
] as const

export const PATTERN_COLORS = [
  '#fef3c7', '#fbbf24', '#ffffff', '#0f172a', '#991b1b', '#134e4a', '#1e3a8a', '#a16207',
]

export const EMBLEMS = ['☾', '★', '⚜', '🦁', '🦅', '⚔', '🐎', '👑', '🔥', '🌹', '☀', '🐺']

export const EMBLEM_COLORS = ['#fef3c7', '#ffffff', '#fbbf24', '#dc2626', '#0f172a', '#22c55e', '#3b82f6', '#e879f9']

export const PATTERNS: { id: BannerPattern; name: string }[] = [
  { id: 'duz', name: 'Düz' },
  { id: 'yatay', name: 'Yatay Şerit' },
  { id: 'dikey', name: 'Dikey Şerit' },
  { id: 'capraz', name: 'Çapraz Şerit' },
  { id: 'bordur', name: 'Bordür' },
]

// SVG sancak çizimi (harita, menü, panel her yerde kullanılır)
export function BannerSVG({ d, className }: { d: BannerDesign; className?: string }) {
  const W = 60, H = 44
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className}>
      <defs>
        <clipPath id="bclip"><rect x="1" y="1" width={W - 2} height={H - 2} rx="4" /></clipPath>
      </defs>
      <g clipPath="url(#bclip)">
        <rect x="0" y="0" width={W} height={H} fill={d.field} />
        {d.pattern === 'yatay' && <rect x="0" y={H / 2 - 5} width={W} height="10" fill={d.patternColor} />}
        {d.pattern === 'dikey' && <rect x={W / 2 - 5} y="0" width="10" height={H} fill={d.patternColor} />}
        {d.pattern === 'capraz' && (
          <>
            <polygon points={`0,0 10,0 ${W},${H} ${W - 10},${H}`} fill={d.patternColor} />
            <polygon points={`${W - 10},0 ${W},0 10,${H} 0,${H}`} fill={d.patternColor} />
          </>
        )}
        {d.pattern === 'bordur' && <rect x="4" y="4" width={W - 8} height={H - 8} fill="none" stroke={d.patternColor} strokeWidth="5" />}
      </g>
      <text x={W / 2} y={H / 2 + 8} fontSize="22" textAnchor="middle" fill={d.emblemColor}
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))' }}>{d.emblem}</text>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="4" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" />
    </svg>
  )
}

// Altın işlemeli köşe süsleri (barok çerçeve)
export function OrnateFrame() {
  return (
    <>
      <img src="/img/orn_corner.png" alt="" className="pointer-events-none absolute -top-2 -left-2 w-16 h-16 sm:w-20 sm:h-20 opacity-90 select-none" />
      <img src="/img/orn_corner.png" alt="" className="pointer-events-none absolute -top-2 -right-2 w-16 h-16 sm:w-20 sm:h-20 opacity-90 select-none -scale-x-100" />
      <img src="/img/orn_corner.png" alt="" className="pointer-events-none absolute -bottom-2 -left-2 w-16 h-16 sm:w-20 sm:h-20 opacity-90 select-none -scale-y-100" />
      <img src="/img/orn_corner.png" alt="" className="pointer-events-none absolute -bottom-2 -right-2 w-16 h-16 sm:w-20 sm:h-20 opacity-90 select-none -scale-100" />
    </>
  )
}

// === CK3 tarzı sancak dizayn ekranı ===
export function BannerDesigner({ design, onChange, onClose }: {
  design: BannerDesign
  onChange: (d: BannerDesign) => void
  onClose: () => void
}) {
  const d = design
  const set = (patch: Partial<BannerDesign>) => onChange({ ...d, ...patch })

  const Swatch = ({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`w-8 h-8 rounded-lg border-2 active:scale-90 transition ${active ? 'border-amber-400 scale-110' : 'border-slate-600'}`}
      style={{ background: color }} />
  )

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-3 z-40" onClick={onClose}>
      <div className="relative bg-slate-900 border border-amber-800/60 rounded-2xl max-w-md w-full max-h-full overflow-y-auto p-5 pt-7"
        onClick={e => e.stopPropagation()}>
        <OrnateFrame />
        <div className="text-center mb-3">
          <div className="text-lg font-bold">⚑ Sancak-ı Şerif Dizaynı</div>
          <div className="text-[11px] text-slate-400">Zemin rengi haritadaki toprak renginiz olur</div>
        </div>

        {/* büyük önizleme */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-1 h-24 bg-amber-900 rounded absolute -left-1 top-0" />
            <BannerSVG d={d} className="w-44 h-32 drop-shadow-2xl" />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Zemin Rengi (harita rengi)</div>
            <div className="flex flex-wrap gap-1.5">
              {FIELD_COLORS.map(([c]) => (
                <Swatch key={c} color={c} active={d.field === c} onClick={() => set({ field: c })} />
              ))}
            </div>
            <div className="text-[9px] text-slate-500 mt-1">Seçili: {FIELD_COLORS.find(([c]) => c === d.field)?.[1]}</div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Desen</div>
            <div className="grid grid-cols-5 gap-1.5">
              {PATTERNS.map(pt => (
                <button key={pt.id} onClick={() => set({ pattern: pt.id })}
                  className={`rounded-lg border p-1 text-[9px] font-bold active:scale-95 transition ${d.pattern === pt.id ? 'border-amber-400 bg-slate-800' : 'border-slate-600'}`}>
                  <BannerSVG d={{ ...d, pattern: pt.id, emblem: '' }} className="w-full h-6 mb-0.5" />
                  {pt.name}
                </button>
              ))}
            </div>
          </div>

          {d.pattern !== 'duz' && (
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Desen Rengi</div>
              <div className="flex flex-wrap gap-1.5">
                {PATTERN_COLORS.map(c => (
                  <Swatch key={c} color={c} active={d.patternColor === c} onClick={() => set({ patternColor: c })} />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Amblem</div>
            <div className="grid grid-cols-6 gap-1.5">
              {EMBLEMS.map(e => (
                <button key={e} onClick={() => set({ emblem: e })}
                  className={`rounded-lg border py-1.5 text-lg active:scale-90 transition ${d.emblem === e ? 'border-amber-400 bg-slate-800' : 'border-slate-600'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Amblem Rengi</div>
            <div className="flex flex-wrap gap-1.5">
              {EMBLEM_COLORS.map(c => (
                <Swatch key={c} color={c} active={d.emblemColor === c} onClick={() => set({ emblemColor: c })} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => onChange({ ...DEFAULT_BANNER })}
              className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold">
              ↺ Varsayılana Dön
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-black">
              ✓ Sancağı Onayla
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
