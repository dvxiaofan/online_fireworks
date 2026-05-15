import { ref } from 'vue'
import type { FireworkType } from './useFireworks'

type AudioContextCtor = typeof AudioContext

const getCtor = (): AudioContextCtor | null => {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ||
    null
  )
}

type AudioGraph = {
  ctx: AudioContext
  dryBus: GainNode
  wetBus: GainNode
  sampleBank: SampleBank
}

const random = (min: number, max: number) => min + Math.random() * (max - min)

type SpatialOptions = {
  pan?: number
  height?: number
}

type SampleBank = {
  launches: AudioBuffer[]
  booms: AudioBuffer[]
  heavyBooms: AudioBuffer[]
  sharpBooms: AudioBuffer[]
  crackles: AudioBuffer[]
  realLaunches: AudioBuffer[]
  realBooms: AudioBuffer[]
  realHeavyBooms: AudioBuffer[]
  realSharpBooms: AudioBuffer[]
  realCrackles: AudioBuffer[]
  realSamplesReady: boolean
}

const realSampleUrls = {
  launches: [
    '/audio/fireworks/launch-1.wav',
    '/audio/fireworks/launch-2.wav',
    '/audio/fireworks/launch-3.wav',
  ],
  booms: [
    '/audio/fireworks/boom-1.wav',
    '/audio/fireworks/boom-2.wav',
    '/audio/fireworks/boom-3.wav',
  ],
  heavyBooms: [
    '/audio/fireworks/boom-heavy-1.wav',
    '/audio/fireworks/boom-heavy-2.wav',
  ],
  sharpBooms: [
    '/audio/fireworks/boom-sharp-1.wav',
    '/audio/fireworks/boom-sharp-2.wav',
  ],
  crackles: [
    '/audio/fireworks/crackle-1.wav',
    '/audio/fireworks/crackle-2.wav',
    '/audio/fireworks/crackle-3.wav',
  ],
}

const toPan = (value = 0.5) => Math.min(Math.max(value * 2 - 1, -1), 1)

const createNoiseBurst = (
  ctx: AudioContext,
  duration: number,
  decayShape: number,
  tone: 'low' | 'mid' | 'high',
) => {
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  let last = 0
  let previous = 0

  for (let i = 0; i < length; i++) {
    const t = i / length
    const envelope = Math.pow(1 - t, decayShape)
    const noise = Math.random() * 2 - 1
    last += (noise - last) * (tone === 'low' ? 0.08 : tone === 'mid' ? 0.22 : 0.55)

    const shaped =
      tone === 'high'
        ? (noise - previous) * 0.72
        : tone === 'mid'
          ? last * 0.65 + noise * 0.35
          : last

    previous = noise
    data[i] = shaped * envelope
  }

  return buffer
}

const createLaunchSample = (ctx: AudioContext, variant: number) => {
  const duration = 0.82 + variant * 0.06
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  let filtered = 0
  for (let i = 0; i < length; i++) {
    const time = i / ctx.sampleRate
    const t = i / length
    const ignition = Math.exp(-time * 48) * Math.sin(Math.PI * 2 * (95 + variant * 18) * time)
    const liftEnvelope = Math.sin(Math.min(t / 0.82, 1) * Math.PI) * Math.pow(1 - t, 0.55)
    const noise = Math.random() * 2 - 1
    filtered += (noise - filtered) * (0.11 + variant * 0.035)
    const whistle = Math.sin(Math.PI * 2 * (900 + 1800 * t + variant * 130) * time) * Math.pow(1 - t, 1.4)

    data[i] = ignition * 0.62 + filtered * liftEnvelope * 0.34 + whistle * 0.08
  }

  return buffer
}

const createBoomSample = (ctx: AudioContext, variant: number, weight: 'standard' | 'heavy' | 'sharp') => {
  const duration = weight === 'heavy' ? 1.25 : weight === 'sharp' ? 0.72 : 0.95
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  let lowNoise = 0
  for (let i = 0; i < length; i++) {
    const time = i / ctx.sampleRate
    const t = i / length
    const hit = Math.exp(-time * (weight === 'heavy' ? 18 : 28)) * Math.sin(Math.PI * 2 * (54 + variant * 9) * time)
    const body = Math.exp(-time * (weight === 'heavy' ? 4.2 : 6.8)) * Math.sin(Math.PI * 2 * (112 + variant * 16) * time)
    const noise = Math.random() * 2 - 1
    lowNoise += (noise - lowNoise) * (weight === 'sharp' ? 0.35 : 0.12)
    const air = lowNoise * Math.pow(1 - t, weight === 'heavy' ? 1.25 : 1.9)
    const slap1 = time > 0.12 ? Math.exp(-(time - 0.12) * 22) * (Math.random() * 2 - 1) : 0
    const slap2 = time > 0.27 ? Math.exp(-(time - 0.27) * 15) * (Math.random() * 2 - 1) : 0

    data[i] =
      hit * (weight === 'sharp' ? 0.45 : 0.68) +
      body * (weight === 'heavy' ? 0.48 : 0.3) +
      air * (weight === 'sharp' ? 0.34 : 0.22) +
      slap1 * 0.07 +
      slap2 * 0.045
  }

  return buffer
}

const createSampleBank = (ctx: AudioContext): SampleBank => ({
  launches: [0, 1, 2].map((variant) => createLaunchSample(ctx, variant)),
  booms: [0, 1, 2].map((variant) => createBoomSample(ctx, variant, 'standard')),
  heavyBooms: [0, 1].map((variant) => createBoomSample(ctx, variant, 'heavy')),
  sharpBooms: [0, 1].map((variant) => createBoomSample(ctx, variant, 'sharp')),
  crackles: [0, 1, 2, 3].map((variant) => createNoiseBurst(ctx, 0.08 + variant * 0.018, 2.3, 'high')),
  realLaunches: [],
  realBooms: [],
  realHeavyBooms: [],
  realSharpBooms: [],
  realCrackles: [],
  realSamplesReady: false,
})

const pick = <Value>(items: Value[]) => items[Math.floor(Math.random() * items.length)]

const decodeSample = async (ctx: AudioContext, url: string) => {
  const response = await fetch(url)
  if (!response.ok) return null

  const arrayBuffer = await response.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}

const loadRealSamples = async (ctx: AudioContext, bank: SampleBank) => {
  const loadGroup = async (urls: string[]) => {
    const decoded = await Promise.all(
      urls.map((url) => decodeSample(ctx, url).catch(() => null)),
    )

    return decoded.filter((buffer): buffer is AudioBuffer => Boolean(buffer))
  }

  const [launches, booms, heavyBooms, sharpBooms, crackles] = await Promise.all([
    loadGroup(realSampleUrls.launches),
    loadGroup(realSampleUrls.booms),
    loadGroup(realSampleUrls.heavyBooms),
    loadGroup(realSampleUrls.sharpBooms),
    loadGroup(realSampleUrls.crackles),
  ])

  bank.realLaunches = launches
  bank.realBooms = booms
  bank.realHeavyBooms = heavyBooms
  bank.realSharpBooms = sharpBooms
  bank.realCrackles = crackles
  bank.realSamplesReady = true
}

const preferReal = (realSamples: AudioBuffer[], fallbackSamples: AudioBuffer[]) =>
  realSamples.length > 0 ? realSamples : fallbackSamples

/**
 * 程式化合成"开阔夜空"的脉冲响应:
 * - 短尾(1.4s),避免拖泥带水覆盖下一发烟花
 * - 衰减幂次 2.6,让早期反射强、尾巴快速隐退
 * - 双声道独立噪声实现立体感,不需要立体声源
 */
const createOutdoorIR = (ctx: AudioContext): AudioBuffer => {
  const duration = 0.85
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      const t = i / length
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.4)
    }
  }
  return buffer
}

export const useSound = () => {
  const enabled = ref(false)
  let graph: AudioGraph | null = null

  const ensureGraph = (): AudioGraph | null => {
    if (graph) return graph
    const Ctor = getCtor()
    if (!Ctor) return null
    const ctx = new Ctor()

    // Dry 总线:直达耳朵,保证清晰度
    const dryBus = ctx.createGain()
    dryBus.gain.value = 1
    dryBus.connect(ctx.destination)

    // Wet 总线:走 ConvolverNode → 户外回响
    const wetBus = ctx.createGain()
    wetBus.gain.value = 0.16
    const reverb = ctx.createConvolver()
    reverb.buffer = createOutdoorIR(ctx)
    wetBus.connect(reverb)
    reverb.connect(ctx.destination)

    const sampleBank = createSampleBank(ctx)
    graph = { ctx, dryBus, wetBus, sampleBank }
    loadRealSamples(ctx, sampleBank).catch(() => {
      sampleBank.realSamplesReady = true
    })
    return graph
  }

  // 把一个声源同时送到 dry 与 wet 两条总线,实现"干 + 湿"混合
  const sendToBuses = (lastNode: AudioNode, g: AudioGraph) => {
    lastNode.connect(g.dryBus)
    lastNode.connect(g.wetBus)
  }

  const playSample = (
    g: AudioGraph,
    buffer: AudioBuffer,
    when: number,
    {
      gain = 1,
      pan = 0,
      playbackRate = 1,
      lowpass,
      highpass,
      wetOnly = false,
      maxDuration,
      fadeOut = 0.18,
    }: {
      gain?: number
      pan?: number
      playbackRate?: number
      lowpass?: number
      highpass?: number
      wetOnly?: boolean
      maxDuration?: number
      fadeOut?: number
    } = {},
  ) => {
    const { ctx } = g
    const duration = Math.min(buffer.duration / playbackRate, maxDuration ?? buffer.duration / playbackRate)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = playbackRate

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(gain, when)
    gainNode.gain.setValueAtTime(gain, Math.max(when, when + duration - fadeOut))
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + duration)

    let lastNode: AudioNode = source
    if (highpass) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = highpass
      lastNode.connect(filter)
      lastNode = filter
    }
    if (lowpass) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = lowpass
      lastNode.connect(filter)
      lastNode = filter
    }

    const panner = ctx.createStereoPanner?.()
    if (panner) {
      panner.pan.value = Math.min(Math.max(pan, -1), 1)
      lastNode.connect(panner)
      lastNode = panner
    }

    lastNode.connect(gainNode)
    if (wetOnly) {
      gainNode.connect(g.wetBus)
    } else {
      sendToBuses(gainNode, g)
    }

    source.start(when)
    source.stop(when + duration)
  }

  const setEnabled = (value: boolean) => {
    enabled.value = value
    if (value) {
      const g = ensureGraph()
      if (g && g.ctx.state === 'suspended') g.ctx.resume()
    }
  }

  // ─── 内部基本声块,playLaunch / playExplode 都复用 ───

  /** 主爆"咚":可调 duration / filter 范围 / Q / 峰值 / 衰减形状 */
  const playBoom = (
    g: AudioGraph,
    when: number,
    {
      duration = 0.3,
      filterStart = 2000,
      filterEnd = 200,
      Q = 1,
      peak = 0.4,
      decayShape = 2,
    }: {
      duration?: number
      filterStart?: number
      filterEnd?: number
      Q?: number
      peak?: number
      decayShape?: number
    } = {},
  ) => {
    const { ctx } = g
    const size = Math.floor(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, decayShape)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filterStart, when)
    filter.frequency.exponentialRampToValueAtTime(filterEnd, when + duration)
    filter.Q.value = Q

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(peak, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration)

    src.connect(filter)
    filter.connect(gain)
    sendToBuses(gain, g)
    src.start(when)
    src.stop(when + duration)
  }

  /** 爆裂层"啪啪啪":多发短促高频 noise burst,模拟 crackle 烟花 */
  const playCrackleLayer = (g: AudioGraph, when: number, count = 12) => {
    const { ctx } = g
    for (let n = 0; n < count; n++) {
      const start = when + random(0, 0.4)
      const dur = random(0.02, 0.05)
      const size = Math.floor(ctx.sampleRate * dur)
      const buf = ctx.createBuffer(1, size, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < size; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, 2)
      }
      const src = ctx.createBufferSource()
      src.buffer = buf

      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = random(2500, 4500)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(random(0.04, 0.09), start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)

      src.connect(filter)
      filter.connect(gain)
      sendToBuses(gain, g)
      src.start(start)
      src.stop(start + dur)
    }
  }

  const playLowThump = (
    g: AudioGraph,
    when: number,
    {
      pan = 0,
      duration = 0.42,
      peak = 0.22,
      frequency = 54,
    }: {
      pan?: number
      duration?: number
      peak?: number
      frequency?: number
    } = {},
  ) => {
    const { ctx } = g
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, when)
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.58, when + duration)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 180

    const panner = ctx.createStereoPanner?.()
    osc.connect(filter)
    filter.connect(gain)
    if (panner) {
      panner.pan.value = pan * 0.35
      gain.connect(panner)
      sendToBuses(panner, g)
    } else {
      sendToBuses(gain, g)
    }

    osc.start(when)
    osc.stop(when + duration)
  }

  /** 短尾哨:给 palm 等花型加点高频"哧——"的尾巴 */
  const playTailWhistle = (g: AudioGraph, when: number) => {
    const { ctx } = g
    const dur = random(0.18, 0.3)
    const start = when + 0.05
    const end = start + dur
    const startFreq = random(1500, 2000)
    const endFreq = startFreq * random(0.5, 0.7)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(startFreq, start)
    osc.frequency.exponentialRampToValueAtTime(endFreq, end)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(random(0.025, 0.045), start + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, end)

    osc.connect(gain)
    sendToBuses(gain, g)
    osc.start(start)
    osc.stop(end)
  }

  // ─── 对外:发射音 ───
  const playLaunch = (panRatio = 0.5) => {
    if (!enabled.value) return
    const g = ensureGraph()
    if (!g) return
    if (g.ctx.state === 'suspended') g.ctx.resume()
    const { ctx } = g
    const now = ctx.currentTime
    const pan = toPan(panRatio)

    const hasRealLaunch = g.sampleBank.realLaunches.length > 0

    playSample(g, pick(preferReal(g.sampleBank.realLaunches, g.sampleBank.launches)), now, {
      gain: hasRealLaunch ? random(0.72, 0.92) : random(0.34, 0.46),
      pan,
      playbackRate: hasRealLaunch ? random(0.96, 1.04) : random(0.92, 1.08),
      lowpass: hasRealLaunch ? random(4200, 6500) : random(2500, 3600),
      maxDuration: 1.25,
      fadeOut: 0.24,
    })

    // 第一层:点火砰(参数随机化)
    const thumpDuration = random(0.04, 0.07)
    const thumpFreq = random(180, 260)
    const thumpVol = hasRealLaunch ? random(0.08, 0.14) : random(0.35, 0.55)
    const thumpSize = Math.floor(ctx.sampleRate * thumpDuration)
    const thumpBuf = ctx.createBuffer(1, thumpSize, ctx.sampleRate)
    const thumpData = thumpBuf.getChannelData(0)
    for (let i = 0; i < thumpSize; i++) {
      thumpData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / thumpSize, 1.5)
    }
    const thumpSrc = ctx.createBufferSource()
    thumpSrc.buffer = thumpBuf
    const thumpFilter = ctx.createBiquadFilter()
    thumpFilter.type = 'lowpass'
    thumpFilter.frequency.value = thumpFreq
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(thumpVol, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + thumpDuration)
    thumpSrc.connect(thumpFilter)
    thumpFilter.connect(thumpGain)
    const thumpPanner = ctx.createStereoPanner?.()
    if (thumpPanner) {
      thumpPanner.pan.value = pan * 0.45
      thumpGain.connect(thumpPanner)
      sendToBuses(thumpPanner, g)
    } else {
      sendToBuses(thumpGain, g)
    }
    thumpSrc.start(now)
    thumpSrc.stop(now + thumpDuration)

    // 第二层:升空嘶(参数随机化)
    const whooshDuration = random(0.48, 0.62)
    const whooshStartFreq = random(550, 760)
    const whooshEndFreq = random(2100, 2700)
    const whooshQ = random(3.5, 5.5)
    const whooshVol = hasRealLaunch ? random(0.035, 0.065) : random(0.13, 0.19)
    const whooshSize = Math.floor(ctx.sampleRate * whooshDuration)
    const whooshBuf = ctx.createBuffer(1, whooshSize, ctx.sampleRate)
    const whooshData = whooshBuf.getChannelData(0)
    for (let i = 0; i < whooshSize; i++) {
      whooshData[i] = (Math.random() * 2 - 1) * 0.5
    }
    const whooshSrc = ctx.createBufferSource()
    whooshSrc.buffer = whooshBuf
    const whooshFilter = ctx.createBiquadFilter()
    whooshFilter.type = 'bandpass'
    whooshFilter.Q.value = whooshQ
    whooshFilter.frequency.setValueAtTime(whooshStartFreq, now + 0.02)
    whooshFilter.frequency.exponentialRampToValueAtTime(whooshEndFreq, now + 0.02 + whooshDuration)
    const whooshGain = ctx.createGain()
    whooshGain.gain.setValueAtTime(0.0001, now + 0.02)
    whooshGain.gain.exponentialRampToValueAtTime(whooshVol, now + 0.12)
    whooshGain.gain.setValueAtTime(whooshVol, now + 0.02 + whooshDuration * 0.6)
    whooshGain.gain.exponentialRampToValueAtTime(0.005, now + 0.02 + whooshDuration)
    whooshSrc.connect(whooshFilter)
    whooshFilter.connect(whooshGain)
    const whooshPanner = ctx.createStereoPanner?.()
    if (whooshPanner) {
      whooshPanner.pan.value = pan * 0.65
      whooshGain.connect(whooshPanner)
      sendToBuses(whooshPanner, g)
    } else {
      sendToBuses(whooshGain, g)
    }
    whooshSrc.start(now + 0.02)
    whooshSrc.stop(now + 0.02 + whooshDuration)

    // 第三层:哨声(55% 概率启用,不是每发都有)
    if (!hasRealLaunch && Math.random() < 0.55) {
      const whistleDuration = random(0.4, 0.55)
      const whistleStart = now + random(0.04, 0.07)
      const whistleEnd = whistleStart + whistleDuration
      const whistleStartFreq = random(1200, 1600)
      const whistleEndFreq = random(2900, 3700)
      const whistleVol = random(0.035, 0.055)
      const vibratoRate = random(6, 10)
      const vibratoDepth = random(8, 18)

      const whistle = ctx.createOscillator()
      whistle.type = 'sine'
      whistle.frequency.setValueAtTime(whistleStartFreq, whistleStart)
      whistle.frequency.exponentialRampToValueAtTime(whistleEndFreq, whistleEnd)

      const vibrato = ctx.createOscillator()
      vibrato.type = 'sine'
      vibrato.frequency.value = vibratoRate
      const vibDepth = ctx.createGain()
      vibDepth.gain.value = vibratoDepth
      vibrato.connect(vibDepth)
      vibDepth.connect(whistle.frequency)
      vibrato.start(whistleStart)
      vibrato.stop(whistleEnd)

      const whistleGain = ctx.createGain()
      whistleGain.gain.setValueAtTime(0.0001, whistleStart)
      whistleGain.gain.exponentialRampToValueAtTime(whistleVol, whistleStart + 0.13)
      whistleGain.gain.setValueAtTime(whistleVol, whistleStart + whistleDuration * 0.7)
      whistleGain.gain.exponentialRampToValueAtTime(0.001, whistleEnd)

      whistle.connect(whistleGain)
      const whistlePanner = ctx.createStereoPanner?.()
      if (whistlePanner) {
        whistlePanner.pan.value = pan * 0.75
        whistleGain.connect(whistlePanner)
        sendToBuses(whistlePanner, g)
      } else {
        sendToBuses(whistleGain, g)
      }
      whistle.start(whistleStart)
      whistle.stop(whistleEnd)
    }
  }

  // ─── 对外:爆炸音(按花型分支) ───
  const playExplode = (type?: FireworkType, burstScale = 1, spatial: SpatialOptions = {}) => {
    if (!enabled.value) return
    const g = ensureGraph()
    if (!g) return
    if (g.ctx.state === 'suspended') g.ctx.resume()
    const pan = toPan(spatial.pan)
    const heightRatio = Math.min(Math.max(spatial.height ?? 0.5, 0, 1))
    const travelDelay = random(0.035, 0.075) + (1 - heightRatio) * 0.09
    const now = g.ctx.currentTime + travelDelay

    // burstScale ∈ [0.38, 1] → sizeFactor ∈ [0.85, 1.10]:小爆稍短、大爆稍长
    const sizeFactor = 0.7 + 0.4 * burstScale
    const distanceMuffle = 1300 + heightRatio * 1200 + burstScale * 700
    const hasRealBoom =
      g.sampleBank.realBooms.length > 0 ||
      g.sampleBank.realHeavyBooms.length > 0 ||
      g.sampleBank.realSharpBooms.length > 0
    const sampleGain = (hasRealBoom ? 0.62 + burstScale * 0.34 : 0.2 + burstScale * 0.2) * random(0.88, 1.12)
    const isGrandShell = type === 'grandShell'
    const boomSamples =
      type === 'willow' || isGrandShell || type === 'clusterBomb' || type === 'waterfall'
        ? preferReal(g.sampleBank.realHeavyBooms, g.sampleBank.heavyBooms)
        : type === 'ring' || type === 'peony' || type === 'heart' || type === 'star'
          ? preferReal(g.sampleBank.realSharpBooms, g.sampleBank.sharpBooms)
          : preferReal(g.sampleBank.realBooms, g.sampleBank.booms)

    playSample(g, pick(boomSamples), now, {
      gain: isGrandShell ? sampleGain * 1.08 : sampleGain,
      pan,
      playbackRate: isGrandShell ? random(0.74, 0.86) : hasRealBoom ? random(0.94, 1.05) : random(0.88, 1.08),
      lowpass: isGrandShell ? 900 + burstScale * 520 : hasRealBoom ? distanceMuffle + 1800 : distanceMuffle,
      maxDuration: isGrandShell ? 2.05 : type === 'willow' ? 2.2 : type === 'clusterBomb' ? 1.55 : 1.75,
      fadeOut: isGrandShell ? 0.42 : 0.28,
    })

    playSample(g, pick(preferReal(g.sampleBank.realBooms, g.sampleBank.booms)), now + random(0.18, 0.38), {
      gain: sampleGain * (hasRealBoom ? 0.07 : 0.16),
      pan: pan * 0.55 + random(-0.18, 0.18),
      playbackRate: hasRealBoom ? random(0.82, 0.96) : random(0.76, 0.94),
      lowpass: hasRealBoom ? 900 + burstScale * 620 : 650 + burstScale * 420,
      wetOnly: true,
      maxDuration: 0.7,
      fadeOut: 0.22,
    })

    switch (type) {
      case 'grandShell':
        playLowThump(g, now, {
          pan,
          duration: random(0.46, 0.62) * sizeFactor,
          peak: hasRealBoom ? random(0.16, 0.24) : random(0.22, 0.32),
          frequency: random(42, 58),
        })
        playBoom(g, now, {
          duration: random(0.5, 0.68) * sizeFactor,
          filterStart: random(720, 1050),
          filterEnd: random(70, 120),
          peak: hasRealBoom ? random(0.03, 0.055) : random(0.14, 0.22),
          decayShape: 1.25,
        })
        break

      case 'clusterBomb':
        playBoom(g, now, {
          duration: random(0.34, 0.48) * sizeFactor,
          filterStart: random(1200, 1700),
          filterEnd: random(100, 180),
          peak: hasRealBoom ? random(0.04, 0.075) : random(0.18, 0.28),
          decayShape: 1.55,
        })
        for (let index = 0; index < 11; index += 1) {
          playSample(g, pick(preferReal(g.sampleBank.realCrackles, g.sampleBank.crackles)), now + random(0.18, 0.95), {
            gain: g.sampleBank.realCrackles.length > 0 ? random(0.12, 0.24) : random(0.035, 0.075),
            pan: pan + random(-0.36, 0.36),
            playbackRate: random(0.82, 1.32),
            highpass: random(1100, 2600),
            maxDuration: 0.58,
            fadeOut: 0.12,
          })
        }
        break

      case 'willow':
        // 低沉、长尾、滚雷感
        playBoom(g, now, {
          duration: random(0.45, 0.6) * sizeFactor,
          filterStart: random(1200, 1700),
          filterEnd: random(120, 180),
          peak: hasRealBoom ? random(0.035, 0.07) : random(0.18, 0.28),
          decayShape: 1.6,
        })
        break

      case 'waterfall':
        playBoom(g, now, {
          duration: random(0.38, 0.5) * sizeFactor,
          filterStart: random(1000, 1450),
          filterEnd: random(120, 190),
          peak: hasRealBoom ? random(0.035, 0.065) : random(0.16, 0.24),
          decayShape: 1.8,
        })
        playTailWhistle(g, now + 0.04)
        break

      case 'text':
        playBoom(g, now, {
          duration: random(0.22, 0.32) * sizeFactor,
          filterStart: random(1900, 2600),
          filterEnd: random(180, 300),
          peak: hasRealBoom ? random(0.03, 0.055) : random(0.14, 0.22),
          decayShape: 2,
        })
        break

      case 'ring':
      case 'peony':
        // 干脆、清晰、有少量谐振
        playBoom(g, now, {
          duration: random(0.26, 0.34) * sizeFactor,
          filterStart: random(2200, 2800),
          filterEnd: random(180, 280),
          Q: 1.6,
          peak: hasRealBoom ? random(0.035, 0.07) : random(0.18, 0.28),
        })
        break

      case 'crackle':
        // 主爆 + ~180ms 后 12-14 发短促高频爆裂
        playBoom(g, now, {
          duration: random(0.22, 0.3) * sizeFactor,
          peak: hasRealBoom ? random(0.03, 0.06) : random(0.16, 0.24),
        })
        if (g.sampleBank.realCrackles.length > 0) {
          for (let index = 0; index < 6; index += 1) {
            playSample(g, pick(g.sampleBank.realCrackles), now + 0.1 + random(0, 0.55), {
              gain: random(0.16, 0.28),
              pan: pan + random(-0.32, 0.32),
              playbackRate: random(0.92, 1.18),
              highpass: random(1200, 2400),
              maxDuration: 0.62,
              fadeOut: 0.12,
            })
          }
          break
        }
        for (let index = 0; index < 9; index += 1) {
          playSample(g, pick(g.sampleBank.crackles), now + 0.12 + random(0, 0.48), {
            gain: random(0.04, 0.085),
            pan: pan + random(-0.28, 0.28),
            playbackRate: random(0.82, 1.45),
            highpass: random(1800, 3400),
            maxDuration: 0.45,
            fadeOut: 0.1,
          })
        }
        playCrackleLayer(g, now + 0.18, 14)
        break

      case 'multistage':
        // 主爆 + ~120ms 后第二爆(更小)
        playBoom(g, now, {
          duration: random(0.26, 0.34) * sizeFactor,
          peak: hasRealBoom ? random(0.035, 0.07) : random(0.18, 0.28),
        })
        playSample(g, pick(preferReal(g.sampleBank.realSharpBooms, g.sampleBank.sharpBooms)), now + random(0.1, 0.14), {
          gain: sampleGain * 0.62,
          pan: pan + random(-0.18, 0.18),
          playbackRate: hasRealBoom ? random(0.96, 1.05) : random(0.95, 1.16),
          lowpass: hasRealBoom ? distanceMuffle + 1900 : distanceMuffle + 300,
          maxDuration: 1.05,
          fadeOut: 0.2,
        })
        playBoom(g, now + random(0.1, 0.14), {
          duration: random(0.18, 0.24),
          peak: hasRealBoom ? random(0.025, 0.05) : random(0.11, 0.18),
          filterStart: random(2200, 2800),
        })
        break

      case 'palm':
        // 主爆 + 短尾哨
        playBoom(g, now, {
          duration: random(0.28, 0.36) * sizeFactor,
          peak: hasRealBoom ? random(0.035, 0.07) : random(0.18, 0.28),
        })
        playTailWhistle(g, now)
        break

      case 'heart':
      case 'star':
        // 略尖锐,高频成分多
        playBoom(g, now, {
          duration: random(0.24, 0.32) * sizeFactor,
          filterStart: random(2400, 3000),
          filterEnd: random(250, 350),
          peak: hasRealBoom ? random(0.03, 0.06) : random(0.16, 0.25),
        })
        break

      case 'gradient':
      case 'chrysanthemum':
      default:
        // 标准爆响:厚重 + 自然
        playBoom(g, now, {
          duration: random(0.27, 0.36) * sizeFactor,
          filterStart: random(1900, 2300),
          filterEnd: random(180, 260),
          peak: hasRealBoom ? random(0.03, 0.06) : random(0.16, 0.26),
        })
        break
    }
  }

  const dispose = () => {
    if (graph) {
      graph.ctx.close().catch(() => {})
      graph = null
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
