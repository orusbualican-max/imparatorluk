// Web Audio API: HTMLAudioElement'in loop aralığındaki boşluğu (gap) olmadan
// kesintisiz müzik döngüsü sağlar. Decode edilen buffer'lar önbelleğe alınır.

let ctx: AudioContext | null = null
let source: AudioBufferSourceNode | null = null
let gain: GainNode | null = null
let current = ''
const bufferCache: Record<string, Promise<AudioBuffer>> = {}

function getCtx(): AudioContext {
  if (!ctx) {
    const w = window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const AC = w.AudioContext ?? w.webkitAudioContext
    ctx = new AC!()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function loadBuffer(src: string): Promise<AudioBuffer> {
  if (!bufferCache[src]) {
    bufferCache[src] = fetch(src)
      .then(r => r.arrayBuffer())
      .then(ab => getCtx().decodeAudioData(ab))
  }
  return bufferCache[src]
}

export function playMusic(src: string) {
  if (current === src && source) return
  stopMusic()
  current = src
  loadBuffer(src).then(buf => {
    if (current !== src) return // bu sırada başka parçaya geçilmiş
    const c = getCtx()
    const s = c.createBufferSource()
    s.buffer = buf
    s.loop = true // sample-accurate döngü: kesinti/boşluk yok
    const g = c.createGain()
    g.gain.value = 0.28
    s.connect(g)
    g.connect(c.destination)
    s.start()
    source = s
    gain = g
  }).catch(() => {})
}

export function stopMusic() {
  current = ''
  try { source?.stop() } catch { /* zaten durmuş olabilir */ }
  source?.disconnect()
  gain?.disconnect()
  source = null
  gain = null
}

export function sfx(src: string, vol = 0.5) {
  const a = new Audio(src)
  a.volume = vol
  a.play().catch(() => {})
}

// Tarayıcı oto-oynatma kilidi: ilk dokunuşta context'i uyandır
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }, { passive: true })
}
