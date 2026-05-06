import { ref } from 'vue'

type AudioContextCtor = typeof AudioContext
const getCtor = (): AudioContextCtor | null => {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ||
    null
  )
}

export const useSound = () => {
  const enabled = ref(false)
  let audioContext: AudioContext | null = null

  const ensureContext = (): AudioContext | null => {
    if (audioContext) return audioContext
    const Ctor = getCtor()
    if (!Ctor) return null
    audioContext = new Ctor()
    return audioContext
  }

  const setEnabled = (value: boolean) => {
    enabled.value = value
    if (value) {
      const ctx = ensureContext()
      if (ctx && ctx.state === 'suspended') {
        ctx.resume()
      }
    }
  }

  const playTone = (
    ctx: AudioContext,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
  ) => {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  }

  const playLaunch = () => {
    if (!enabled.value) return
    const ctx = ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    playTone(ctx, 280, 0.15, 0.15, 'triangle')
    setTimeout(() => {
      playTone(ctx, 380, 0.1, 0.08, 'triangle')
    }, 50)
  }

  const playExplode = () => {
    if (!enabled.value) return
    const ctx = ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const noiseLength = 0.3
    const bufferSize = ctx.sampleRate * noiseLength
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2000, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + noiseLength)

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noiseLength)

    source.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    source.start()
    source.stop(ctx.currentTime + noiseLength)
  }

  const dispose = () => {
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
  }

  return {
    enabled,
    setEnabled,
    playLaunch,
    playExplode,
    dispose,
  }
}
