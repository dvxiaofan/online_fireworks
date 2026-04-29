let audioContext: AudioContext | null = null
let enabled = false

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

const playTone = (frequency: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
  const ctx = getAudioContext()
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

export const useSound = () => {
  const setEnabled = (value: boolean) => {
    enabled = value
  }

  const isEnabled = () => enabled

  const playLaunch = () => {
    if (!enabled) return

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    playTone(280, 0.15, 0.15, 'triangle')
    setTimeout(() => {
      playTone(380, 0.1, 0.08, 'triangle')
    }, 50)
  }

  const playExplode = () => {
    if (!enabled) return

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

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

  return {
    setEnabled,
    isEnabled,
    playLaunch,
    playExplode,
  }
}