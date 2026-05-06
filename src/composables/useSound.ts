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

  const playLaunch = () => {
    if (!enabled.value) return
    const ctx = ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime

    // ── 第一层:点火"砰"——很短的低频炸响,~50ms
    // 模拟底火/发射药点燃瞬间的低音冲击。
    const thumpDuration = 0.05
    const thumpSize = Math.floor(ctx.sampleRate * thumpDuration)
    const thumpBuffer = ctx.createBuffer(1, thumpSize, ctx.sampleRate)
    const thumpData = thumpBuffer.getChannelData(0)
    for (let i = 0; i < thumpSize; i++) {
      // 衰减白噪声
      thumpData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / thumpSize, 1.5)
    }
    const thumpSrc = ctx.createBufferSource()
    thumpSrc.buffer = thumpBuffer

    const thumpFilter = ctx.createBiquadFilter()
    thumpFilter.type = 'lowpass'
    thumpFilter.frequency.value = 220

    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0.45, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + thumpDuration)

    thumpSrc.connect(thumpFilter)
    thumpFilter.connect(thumpGain)
    thumpGain.connect(ctx.destination)
    thumpSrc.start(now)
    thumpSrc.stop(now + thumpDuration)

    // ── 第二层:升空"嘶——"——~550ms 升调白噪声
    // 用 bandpass 滤波白噪声,中心频率从 650Hz 指数升到 2400Hz,
    // 模拟火箭升空时空气流速加快 / 多普勒导致的音调上升。
    const whooshDuration = 0.55
    const whooshSize = Math.floor(ctx.sampleRate * whooshDuration)
    const whooshBuffer = ctx.createBuffer(1, whooshSize, ctx.sampleRate)
    const whooshData = whooshBuffer.getChannelData(0)
    for (let i = 0; i < whooshSize; i++) {
      whooshData[i] = (Math.random() * 2 - 1) * 0.5
    }
    const whooshSrc = ctx.createBufferSource()
    whooshSrc.buffer = whooshBuffer

    const whooshFilter = ctx.createBiquadFilter()
    whooshFilter.type = 'bandpass'
    whooshFilter.Q.value = 4.5
    whooshFilter.frequency.setValueAtTime(650, now + 0.02)
    whooshFilter.frequency.exponentialRampToValueAtTime(2400, now + 0.02 + whooshDuration)

    const whooshGain = ctx.createGain()
    // ADSR 风格包络:快速起音 → 持续 → 末段衰减
    whooshGain.gain.setValueAtTime(0.0001, now + 0.02)
    whooshGain.gain.exponentialRampToValueAtTime(0.16, now + 0.12)
    whooshGain.gain.setValueAtTime(0.16, now + 0.02 + whooshDuration * 0.6)
    whooshGain.gain.exponentialRampToValueAtTime(0.005, now + 0.02 + whooshDuration)

    whooshSrc.connect(whooshFilter)
    whooshFilter.connect(whooshGain)
    whooshGain.connect(ctx.destination)
    whooshSrc.start(now + 0.02)
    whooshSrc.stop(now + 0.02 + whooshDuration)

    // ── 第三层:哨声"咻——"——sine 振荡器升调,~480ms
    // 模拟"哨笛型"烟花的高频啸叫,在第二层嘶声之上叠一条清晰的旋律线。
    // 起音稍晚(50ms),让点火砰先到位,避免三层同时起音糊在一起。
    const whistleDuration = 0.48
    const whistleStart = now + 0.05
    const whistleEnd = whistleStart + whistleDuration

    const whistle = ctx.createOscillator()
    whistle.type = 'sine'
    whistle.frequency.setValueAtTime(1400, whistleStart)
    whistle.frequency.exponentialRampToValueAtTime(3400, whistleEnd)

    // Vibrato:8Hz 颤音,深度 ±14Hz,让纯音不死板
    const vibrato = ctx.createOscillator()
    vibrato.type = 'sine'
    vibrato.frequency.value = 8
    const vibratoDepth = ctx.createGain()
    vibratoDepth.gain.value = 14
    vibrato.connect(vibratoDepth)
    vibratoDepth.connect(whistle.frequency)
    vibrato.start(whistleStart)
    vibrato.stop(whistleEnd)

    const whistleGain = ctx.createGain()
    // 高频 sine 直接 0.06 已经很尖,更高反而刺耳。包络让尾段尽快淡出。
    whistleGain.gain.setValueAtTime(0.0001, whistleStart)
    whistleGain.gain.exponentialRampToValueAtTime(0.05, whistleStart + 0.13)
    whistleGain.gain.setValueAtTime(0.05, whistleStart + whistleDuration * 0.7)
    whistleGain.gain.exponentialRampToValueAtTime(0.001, whistleEnd)

    whistle.connect(whistleGain)
    whistleGain.connect(ctx.destination)
    whistle.start(whistleStart)
    whistle.stop(whistleEnd)
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
