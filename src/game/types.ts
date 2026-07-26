export type UnitType = 'piyade' | 'okcu' | 'suvari' | 'topcu'
export type RelationState = 'savas' | 'baris'
export type Terrain = 'duzluk' | 'dag' | 'orman' | 'col' | 'kiyi'
export type Building = 'ciftlik' | 'pazar' | 'kosla' | 'tapinak'
export type ManaType = 'idari' | 'diplomatik' | 'askeri'
export type Law = 'serf_azadi' | 'zorunlu_askerlik' | 'serbest_ticaret'
export type GroupId = 'halk' | 'soylular' | 'ordu' | 'tuccarlar'

export interface ArmyComp { piyade: number; okcu: number; suvari: number; topcu?: number }

export interface Province {
  id: string
  name: string
  x: number
  y: number
  owner: string
  occupiedBy?: string // işgal eden devlet (owner'dan farklıysa gelir yok)
  core: boolean // çekirdek eyalet mi
  unrest: number // 0-100 isyan riski
  terrain: Terrain
  building?: Building
  manpower: number
  maxManpower: number
  gold: number
  food: number
  garrison: ArmyComp
  adj: string[]
  isCapital?: boolean
}

export interface Faction {
  id: string
  name: string
  color: string
  isPlayer: boolean
  gold: number
  food: number
  army?: ArmyComp
  armyLocation?: string
  alive: boolean
  relation: number
  state: RelationState
  tradeAgreement: boolean
  alliance?: boolean // askeri ittifak (savaş ilan etmez, savunmada destek yollar)
}

export type TaxLevel = 'dusuk' | 'orta' | 'yuksek'
export type Edict = 'none' | 'panayir' | 'askeri_seferberlik' | 'tahil_ambari'

export interface GameState {
  turn: number
  provinces: Record<string, Province>
  factions: Record<string, Faction>
  tax: TaxLevel
  edict: Edict
  approval: number
  stability: number
  mana: Record<ManaType, number> // EU4 monarch power
  techs: Record<ManaType, number> // 0-3 seviye
  laws: Record<Law, boolean> // Vic3 kanunlar
  groups: Record<GroupId, number> // 0-100 memnuniyet
  warScore: Record<string, number> // düşman id -> skor (+ biz kazanıyoruz)
  armyXP: number // ordu tecrübesi (seviye = hasar bonusu)
  coalitionFormed: boolean
  pendingEvent?: ChoiceEvent
  log: string[]
  gameOver?: 'win' | 'lose'
  pendingBattle?: { provinceId: string; attacker: string }
}

export interface ChoiceEvent {
  id: string
  title: string
  text: string
  img?: string
  options: { label: string; desc: string }[]
}

export const UNIT_INFO: Record<UnitType, { name: string; cost: number; food: number; manpower: number; desc: string }> = {
  piyade: { name: 'Piyade', cost: 60, food: 1, manpower: 1, desc: 'Sağlam yakın dövüş birliği' },
  okcu: { name: 'Okçu', cost: 80, food: 1, manpower: 1, desc: 'Uzak mesafeden vurur' },
  suvari: { name: 'Süvari', cost: 120, food: 2, manpower: 2, desc: 'Hızlı, yıkıcı hücum' },
  topcu: { name: 'Topçu', cost: 200, food: 2, manpower: 2, desc: 'Uzun menzilli yıkıcı top ateşi' },
}

export const TERRAIN_INFO: Record<Terrain, { name: string; icon: string; desc: string }> = {
  duzluk: { name: 'Düzlük', icon: '🌾', desc: 'Standart arazi' },
  dag: { name: 'Dağlık', icon: '⛰', desc: 'Savunmacı birlikler +20 dayanıklılık' },
  orman: { name: 'Orman', icon: '🌲', desc: 'Savunmacı birlikler +10 dayanıklılık' },
  col: { name: 'Çöl', icon: '🏜', desc: 'Erzak üretimi düşük' },
  kiyi: { name: 'Kıyı', icon: '⚓', desc: 'Ticaret geliri yüksek' },
}

export const BUILDING_INFO: Record<Building, { name: string; icon: string; cost: number; desc: string }> = {
  ciftlik: { name: 'Çiftlik', icon: '🌾', cost: 80, desc: '+4 erzak/tur' },
  pazar: { name: 'Pazar', icon: '🏪', cost: 100, desc: '+25 altın/tur' },
  kosla: { name: 'Kışla', icon: '🏯', cost: 90, desc: '+2 azami asker kaynağı, +1 yenilenme' },
  tapinak: { name: 'Tapınak', icon: '⛩', cost: 90, desc: 'İsyan riski -5/tur' },
}

export const LAW_INFO: Record<Law, { name: string; icon: string; cost: number; desc: string; effects: string }> = {
  serf_azadi: { name: 'Serf Azadı', icon: '⛓', cost: 30, desc: 'Halk özgürleşir', effects: 'Halk +20, Soylular -20 · Erzak +2/tur' },
  zorunlu_askerlik: { name: 'Zorunlu Askerlik', icon: '🎖', cost: 30, desc: 'Herkes askere', effects: 'Ordu +15, Halk -10 · Asker kaynağı yenilenmesi +1' },
  serbest_ticaret: { name: 'Serbest Ticaret', icon: '⚖', cost: 30, desc: 'Pazarlar açılır', effects: 'Tüccarlar +20, Soylular -10 · Altın +15/tur' },
}

export const GROUP_INFO: Record<GroupId, { name: string; icon: string; desc: string }> = {
  halk: { name: 'Halk', icon: '👨‍🌾', desc: 'Vergiden ve savaştan etkilenir' },
  soylular: { name: 'Soylular', icon: '🤴', desc: 'Ayrıcalıklarını korur' },
  ordu: { name: 'Ordu', icon: '🎖', desc: 'Güçlü ordu ister' },
  tuccarlar: { name: 'Tüccarlar', icon: '💼', desc: 'Ticareti sever' },
}

export const TECH_INFO: Record<ManaType, { name: string; icon: string; levels: { name: string; desc: string }[] }> = {
  idari: {
    name: 'İdari Gelişmeler', icon: '🏛',
    levels: [
      { name: 'Bürokrasi', desc: 'Vergi geliri +%10' },
      { name: 'İmar Programı', desc: 'Bina maliyeti -%25' },
      { name: 'Merkeziyet', desc: 'Çekirdek maliyeti -%40' },
    ],
  },
  diplomatik: {
    name: 'Diplomatik Gelişmeler', icon: '🕊',
    levels: [
      { name: 'Elçilik Okulu', desc: 'Hediye etkisi 2 kat' },
      { name: 'Ticaret Yolları', desc: 'Ticaret geliri +15/anlaşma' },
      { name: 'Güven İnşası', desc: 'İlişkiler her tur +2 iyileşir' },
    ],
  },
  askeri: {
    name: 'Askeri Gelişmeler', icon: '⚔',
    levels: [
      { name: 'Talim', desc: 'Birlik hasarı +%15' },
      { name: 'Lojistik', desc: 'Asker kaynağı yenilenmesi +1' },
      { name: 'Komuta Sanatı', desc: 'Birlik morali +25 başlangıç (moral kaybı -%30)' },
    ],
  },
}
