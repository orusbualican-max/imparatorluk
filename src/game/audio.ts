let music: HTMLAudioElement | null = null
let current = ''

export function playMusic(src: string) {
  if (current === src && music && !music.paused) return
  stopMusic()
  current = src
  music = new Audio(src)
  music.loop = true
  music.volume = 0.28
  music.play().catch(() => {})
}

export function stopMusic() {
  music?.pause()
  music = null
  current = ''
}

export function sfx(src: string, vol = 0.5) {
  const a = new Audio(src)
  a.volume = vol
  a.play().catch(() => {})
}
