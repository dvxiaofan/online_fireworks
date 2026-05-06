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

type AudioGraph = {
  ctx: AudioContext
  dryBus: GainNode
  wetBus: GainNode
}

const random = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * 程式化合成"开阔夜空"的脉冲响应:
 * - 短尾(1.4s),避免拖泥带水覆盖下一发烟花
 * - 衰减幂次 2.6,让早期反射强、尾巴快速隐退
 * - 双声道独立噪声实现立体感,不需要立体声源
 */
const createOutdoorIR = (ctx: AudioContext): AudioBuffer => {
  const duration = 1.4
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      const t = i / length
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6)
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
    wetBus.gain.value = 0.28
    const reverb = ctx.createConvolver()
    reverb.buffer = createOutdoorIR(ctx)
    wetBus.connect(reverb)
    reverb.connect(ctx.destination)

    graph = { ctx, dryBus, wetBus }
    return graph
  }

  // 把一个声源同时送到 dry 与 wet 两条总线,实现"干 + 湿"混合
  const sendToBuses = (lastNode: AudioNode, g: AudioGraph) => {
    lastNode.connect(g.dryBus)
    lastNode.connect(g.wetBus)
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
  const playLaunch = () => {
    if (!enabled.value) return
    const g = ensureGraph()
    if (!g) return
    if (g.ctx.state === 'suspended') g.ctx.resume()
    const { ctx } = g
    const now = ctx.currentTime

    // 第一层:点火砰(参数随机化)
    const thumpDuration = random(0.04, 0.07)
    const thumpFreq = random(180, 260)
    const thumpVol = random(0.35, 0.55)
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
    sendToBuses(thumpGain, g)
    thumpSrc.start(now)
    thumpSrc.stop(now + thumpDuration)

    // 第二层:升空嘶(参数随机化)
    const whooshDuration = random(0.48, 0.62)
    const whooshStartFreq = random(550, 760)
    const whooshEndFreq = random(2100, 2700)
    const whooshQ = random(3.5, 5.5)
    const whooshVol = random(0.13, 0.19)
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
    sendToBuses(whooshGain, g)
    whooshSrc.start(now + 0.02)
    whooshSrc.stop(now + 0.02 + whooshDuration)

    // 第三层:哨声(55% 概率启用,不是每发都有)
    if (Math.random() < 0.55) {
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
      sendToBuses(whistleGain, g)
      whistle.start(whistleStart)
      whistle.stop(whistleEnd)
    }
  }

  // ─── 对外:爆炸音(按花型分支) ───
  const playExplode = (type?: string, burstScale = 1) => {
    if (!enabled.value) return
    const g = ensureGraph()
    if (!g) return
    if (g.ctx.state === 'suspended') g.ctx.resume()
    const now = g.ctx.currentTime

    // burstScale ∈ [0.38, 1] → sizeFactor ∈ [0.85, 1.10]:小爆稍短、大爆稍长
    const sizeFactor = 0.7 + 0.4 * burstScale

    switch (type) {
      case 'willow':
        // 低沉、长尾、滚雷感
        playBoom(g, now, {
          duration: random(0.45, 0.6) * sizeFactor,
          filterStart: random(1200, 1700),
          filterEnd: random(120, 180),
          peak: random(0.38, 0.5),
          decayShape: 1.6,
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
          peak: random(0.4, 0.5),
        })
        break

      case 'crackle':
        // 主爆 + ~180ms 后 12-14 发短促高频爆裂
        playBoom(g, now, {
          duration: random(0.22, 0.3) * sizeFactor,
          peak: random(0.35, 0.45),
        })
        playCrackleLayer(g, now + 0.18, 14)
        break

      case 'multistage':
        // 主爆 + ~120ms 后第二爆(更小)
        playBoom(g, now, {
          duration: random(0.26, 0.34) * sizeFactor,
          peak: random(0.4, 0.5),
        })
        playBoom(g, now + random(0.1, 0.14), {
          duration: random(0.18, 0.24),
          peak: random(0.22, 0.32),
          filterStart: random(2200, 2800),
        })
        break

      case 'palm':
        // 主爆 + 短尾哨
        playBoom(g, now, {
          duration: random(0.28, 0.36) * sizeFactor,
          peak: random(0.4, 0.5),
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
          peak: random(0.36, 0.46),
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
          peak: random(0.36, 0.48),
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
