type FireworkOptions = {
  canvas: HTMLCanvasElement
  onExplode?: (
    type: FireworkType,
    burstScale: number,
    position: { x: number; y: number; width: number; height: number },
  ) => void
}

type ExplosionPoint = {
  x: number
  y: number
  burstScale: number
}

export type FireworkType = 'chrysanthemum' | 'peony' | 'ring' | 'willow' | 'palm' | 'crackle' | 'heart' | 'star' | 'multistage' | 'gradient' | 'grandShell' | 'clusterBomb' | 'waterfall' | 'text'

export type ThemeId = 'default' | 'cny' | 'christmas' | 'birthday' | 'sakura' | 'ocean'

type Theme = {
  id: ThemeId
  name: string
  // hue 区间(支持跨 0/360 边界,使用多个 bucket)
  hueBuckets: Array<[number, number]>
}

export const THEMES: Theme[] = [
  {
    id: 'default',
    name: '随机',
    hueBuckets: [[0, 360]],
  },
  {
    id: 'cny',
    name: '春节',
    // 红、金、橙
    hueBuckets: [
      [350, 360],
      [0, 18],
      [38, 55],
    ],
  },
  {
    id: 'christmas',
    name: '圣诞',
    // 红、绿、白偏冷蓝
    hueBuckets: [
      [350, 360],
      [0, 12],
      [110, 140],
      [190, 210],
    ],
  },
  {
    id: 'birthday',
    name: '生日',
    // 粉、紫、黄
    hueBuckets: [
      [290, 330],
      [255, 285],
      [45, 60],
    ],
  },
  {
    id: 'sakura',
    name: '樱花',
    // 粉白
    hueBuckets: [
      [310, 350],
      [0, 10],
    ],
  },
  {
    id: 'ocean',
    name: '海洋',
    // 蓝绿青
    hueBuckets: [
      [170, 220],
      [220, 250],
    ],
  },
]

const getThemeById = (id: ThemeId): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0]

type Rocket = {
  x: number
  y: number
  previousX: number
  previousY: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  hue: number
  life: number
  type: FireworkType
  burstScale: number
}

type TrailSpark = {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  radius: number
  hue: number
}

type Particle = {
  x: number
  y: number
  previousX: number
  previousY: number
  vx: number
  vy: number
  hue: number
  alpha: number
  decay: number
  radius: number
  gravity: number
  friction: number
  shimmer: number
  crackle: boolean
  subExplosionDelay: number
  subExplosionDone: boolean
  subExplosionType: 'none' | 'spark' | 'cluster'
  age: number
  isText: boolean
  textPhaseDecay: number
}

const fireworkTypes: FireworkType[] = ['chrysanthemum', 'peony', 'ring', 'willow', 'palm', 'crackle', 'heart', 'star', 'multistage', 'gradient', 'grandShell', 'clusterBomb', 'waterfall'/* , 'text' */]
const SPECIAL_LOCK_TYPES: FireworkType[] = ['text', 'clusterBomb', 'grandShell']
const SPECIAL_UNLOCK_DELAY = 1500
const textFireworkMessages = ['LOVE', '2026', 'HAPPY', 'WOW']

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1))

const randomItem = <Value>(items: Value[]) => items[Math.floor(Math.random() * items.length)]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getExplosionYRange = (height: number) => {
  const minDistanceFromTop = clamp(height * 0.12, 88, 150)
  const minDistanceFromBottom = clamp(height * 0.28, 220, 360)

  return {
    minY: minDistanceFromTop,
    maxY: Math.max(minDistanceFromTop + 80, height - minDistanceFromBottom),
  }
}

const getExplosionXRange = (width: number) => {
  const minDistanceFromSide = clamp(width * 0.28, 112, 260)

  return {
    minX: minDistanceFromSide,
    maxX: Math.max(minDistanceFromSide, width - minDistanceFromSide),
  }
}

const getBurstScale = (x: number, y: number, width: number, height: number) => {
  const horizontalSpace = Math.min(x, width - x)
  const verticalSpace = Math.min(y, height - y)
  const availableSpace = Math.min(horizontalSpace, verticalSpace * 1.25)

  return clamp(availableSpace / 320, 0.38, 1)
}

const getHeartPoints = (count: number, scale: number) => {
  const points: Array<{ angle: number; speed: number }> = []
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(t), 3)
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    const angle = Math.atan2(y, x)
    const dist = Math.sqrt(x * x + y * y)
    points.push({ angle, speed: dist * scale * 0.35 })
  }
  return points
}

const getStarPoints = (count: number, scale: number) => {
  const points: Array<{ angle: number; speed: number }> = []
  const outerRadius = count * scale * 0.22
  const innerRadius = outerRadius * 0.45

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const isOuter = Math.sin(i * 3.5) > 0
    const radius = isOuter ? outerRadius : innerRadius
    points.push({ angle, speed: radius * 0.12 })
  }
  return points
}

const getTextPoints = (text: string, scale: number) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  canvas.width = 600
  canvas.height = 240
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Impact 笔画粗但 counter space 大,"0"内部空洞清晰可见
  ctx.font = '140px Impact'

  const measured = ctx.measureText(text)
  const fitScale = Math.min(1, 520 / Math.max(measured.width, 1))
  ctx.font = `${Math.floor(140 * fitScale)}px Impact`
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const points: Array<{ x: number; y: number }> = []
  const step = 3

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = image.data[(y * canvas.width + x) * 4 + 3]
      if (alpha > 80) {
        points.push({
          x: (x - canvas.width / 2) * scale,
          y: (y - canvas.height / 2) * scale,
        })
      }
    }
  }

  return points.length > 600
    ? points.filter(() => Math.random() < 600 / points.length)
    : points
}

export const useFireworks = ({ canvas, onExplode }: FireworkOptions) => {
  const rockets: Rocket[] = []
  const trailSparks: TrailSpark[] = []
  const particles: Particle[] = []

  let animationFrameId = 0
  let context = canvas.getContext('2d')
  let width = 0
  let height = 0
  let pixelRatio = 1
  let currentTheme: Theme = getThemeById('default')
  let isLocked = false
  let unlockTimerId: ReturnType<typeof setTimeout> | null = null

  const sampleHue = () => {
    const bucket = currentTheme.hueBuckets[
      Math.floor(Math.random() * currentTheme.hueBuckets.length)
    ]
    return randomBetween(bucket[0], bucket[1])
  }

  const setTheme = (id: ThemeId) => {
    currentTheme = getThemeById(id)
  }

  const paintSky = (ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)

    gradient.addColorStop(0, '#02040b')
    gradient.addColorStop(0.58, '#07111f')
    gradient.addColorStop(1, '#101723')

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    width = window.innerWidth
    height = window.innerHeight

    canvas.width = Math.floor(width * pixelRatio)
    canvas.height = Math.floor(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    context = canvas.getContext('2d')
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    if (context) {
      paintSky(context)
    }
  }

  const launch = (clientX: number) => {
    const startX = width * 0.5 + randomBetween(-32, 32)
    const startY = height + 24
    const { minX, maxX } = getExplosionXRange(width)
    const { minY, maxY } = getExplosionYRange(height)
    const type = randomItem(fireworkTypes)
    if (SPECIAL_LOCK_TYPES.includes(type)) {
      isLocked = true
    }
    const targetX = clamp(clientX + randomBetween(-64, 64), minX, maxX)
    const targetY = type === 'grandShell' || type === 'clusterBomb' || type === 'waterfall'
      ? randomBetween(minY, Math.max(minY + 40, minY + (maxY - minY) * 0.38))
      : randomBetween(minY, maxY)
    const burstScale = type === 'grandShell' || type === 'clusterBomb' || type === 'waterfall'
      ? clamp(getBurstScale(targetX, targetY, width, height) * 1.38, 0.82, 1.32)
      : getBurstScale(targetX, targetY, width, height)
    const createRocket = (point: ExplosionPoint, startOffsetX = 0, delayFrames = 0) => {
      const localStartX = width * 0.5 + startOffsetX + randomBetween(-14, 14)
      const localFlightTime = type === 'grandShell' || type === 'clusterBomb' || type === 'waterfall' ? randomBetween(96, 126) : randomBetween(80, 110)
      const effectiveGravity = 0.025
      const vx = (point.x - localStartX) / localFlightTime
      const vy = (point.y - startY) / localFlightTime - 0.5 * effectiveGravity * localFlightTime

      rockets.push({
        x: localStartX,
        y: startY,
        previousX: localStartX,
        previousY: startY,
        targetX: point.x,
        targetY: point.y,
        vx,
        vy,
        hue: sampleHue(),
        life: -delayFrames,
        type,
        burstScale: point.burstScale,
      })
    }

    if (type === 'waterfall') {
      const cascadeCount = randomInt(5, 10)
      const centerIndex = (cascadeCount - 1) / 2
      const spacing = clamp(width * 0.08, 42, 92)

      for (let index = 0; index < cascadeCount; index += 1) {
        const x = clamp(targetX + (index - centerIndex) * spacing + randomBetween(-18, 18), minX, maxX)
        const y = clamp(targetY + randomBetween(-18, 18), minY, maxY)
        createRocket(
          {
            x,
            y,
            burstScale: clamp(getBurstScale(x, y, width, height) * 1.18, 0.72, 1.12),
          },
          (index - centerIndex) * clamp(width * 0.055, 30, 64),
          Math.floor(Math.abs(index - centerIndex) * 2),
        )
      }

      return
    }

    // 反推弹道:给定飞行帧数 t,在重力作用下解出能真正命中 (targetX, targetY)
    // 的初速度。原本用 angle*speed 直接指向目标,忽略了 updateRocket 里
    // 每帧叠加的重力 → vy 衰减 → y 落后、x 超调 → 火箭飞出屏幕外才爆炸。
    //   x(t) = startX + vx·t           ⇒ vx = Δx / t
    //   y(t) = startY + vy·t + ½·g·t²  ⇒ vy = Δy/t − ½·g·t
    const flightTime = type === 'grandShell' || type === 'clusterBomb' ? randomBetween(96, 126) : randomBetween(80, 110)
    // updateRocket 中 vy < -2 时重力 0.025,>= -2 时 0.08。火箭多数时间
    // 在快速上升期(vy 很负),用 0.025 作为有效重力近似。
    const effectiveGravity = 0.025
    const vx = (targetX - startX) / flightTime
    const vy = (targetY - startY) / flightTime - 0.5 * effectiveGravity * flightTime

    rockets.push({
      x: startX,
      y: startY,
      previousX: startX,
      previousY: startY,
      targetX,
      targetY,
      vx,
      vy,
      hue: sampleHue(),
      life: 0,
      type,
      burstScale,
    })
  }

  const createParticle = (
    x: number,
    y: number,
    angle: number,
    speed: number,
    hue: number,
    type: FireworkType,
    burstScale: number,
  ) => {
    const isWillow = type === 'willow'
    const isPeony = type === 'peony'
    const isCrackle = type === 'crackle'
    const isMultistage = type === 'multistage'
    const isGrandShell = type === 'grandShell'
    const isClusterBomb = type === 'clusterBomb'
    const isWaterfall = type === 'waterfall'
    const isText = type === 'text'
    const subExplosionType = isClusterBomb ? 'cluster' : isMultistage ? 'spark' : 'none'

    particles.push({
      x,
      y,
      previousX: x,
      previousY: y,
      vx: Math.cos(angle) * speed * burstScale,
      vy: Math.sin(angle) * speed * burstScale,
      hue: hue + randomBetween(-18, 18),
      alpha: randomBetween(0.82, 1),
      decay: isText ? randomBetween(0.003, 0.005) : isWaterfall ? randomBetween(0.0022, 0.0042) : isWillow ? randomBetween(0.005, 0.009) : isGrandShell || isClusterBomb ? randomBetween(0.006, 0.011) : randomBetween(0.009, 0.018),
      radius: isText ? randomBetween(1.5, 2.4) : isWaterfall ? randomBetween(1.15, 2.05) : isGrandShell || isClusterBomb ? randomBetween(1.8, 3.1) : isPeony ? randomBetween(2.1, 3.4) : randomBetween(1.2, 2.5),
      gravity: isText ? randomBetween(0.01, 0.025) : isWaterfall ? randomBetween(0.012, 0.026) : isWillow ? randomBetween(0.08, 0.13) : isGrandShell || isClusterBomb ? randomBetween(0.018, 0.042) : randomBetween(0.035, 0.075),
      friction: isText ? randomBetween(0.988, 0.996) : isWaterfall ? randomBetween(0.996, 0.999) : isWillow ? randomBetween(0.973, 0.985) : isGrandShell || isClusterBomb ? randomBetween(0.984, 0.993) : randomBetween(0.962, 0.986),
      shimmer: isText ? randomBetween(0.006, 0.02) : isWaterfall ? randomBetween(0.006, 0.022) : isGrandShell || isClusterBomb ? randomBetween(0.004, 0.018) : randomBetween(0.012, 0.05),
      crackle: isCrackle && Math.random() > 0.45,
      subExplosionDelay: isClusterBomb && Math.random() > 0.42
        ? randomBetween(18, 74)
        : isMultistage
          ? randomBetween(40, 80)
          : 0,
      subExplosionDone: false,
      subExplosionType,
      age: 0,
      isText,
      textPhaseDecay: isText ? randomBetween(0.018, 0.03) : 0,
    })
  }

  const explode = (rocket: Rocket) => {
    const baseHue = rocket.hue

    if (rocket.type === 'grandShell') {
      const outerCount = randomInt(240, 320)
      const coreCount = randomInt(130, 180)
      const outerSpeed = randomBetween(7.2, 8.8)
      const accentHue = baseHue + randomBetween(28, 54)

      for (let index = 0; index < outerCount; index += 1) {
        const angle = (Math.PI * 2 * index) / outerCount
        const speed = outerSpeed * randomBetween(0.94, 1.04)
        createParticle(rocket.x, rocket.y, angle, speed, baseHue, rocket.type, rocket.burstScale)
      }

      for (let index = 0; index < coreCount; index += 1) {
        const angle = randomBetween(0, Math.PI * 2)
        const normalized = Math.sqrt(Math.random())
        const speed = normalized * randomBetween(2.6, 6.4)
        createParticle(rocket.x, rocket.y, angle, speed, index % 3 === 0 ? accentHue : baseHue, rocket.type, rocket.burstScale * 0.92)
      }

      const haloCount = randomInt(72, 96)
      for (let index = 0; index < haloCount; index += 1) {
        const angle = (Math.PI * 2 * index) / haloCount + randomBetween(-0.012, 0.012)
        createParticle(rocket.x, rocket.y, angle, outerSpeed * 1.14, accentHue, rocket.type, rocket.burstScale)
      }

      return
    }

    if (rocket.type === 'clusterBomb') {
      const outerCount = randomInt(210, 280)
      const coreCount = randomInt(150, 210)
      const outerSpeed = randomBetween(6.5, 8)
      const accentHue = baseHue + randomBetween(34, 76)

      for (let index = 0; index < outerCount; index += 1) {
        const angle = (Math.PI * 2 * index) / outerCount
        const speed = outerSpeed * randomBetween(0.9, 1.05)
        createParticle(rocket.x, rocket.y, angle, speed, baseHue, rocket.type, rocket.burstScale)
      }

      for (let index = 0; index < coreCount; index += 1) {
        const angle = randomBetween(0, Math.PI * 2)
        const normalized = Math.sqrt(Math.random())
        const speed = normalized * randomBetween(1.8, 6.2)
        createParticle(rocket.x, rocket.y, angle, speed, index % 2 === 0 ? accentHue : baseHue, rocket.type, rocket.burstScale * 0.84)
      }

      return
    }

    const createWaterfallBurst = (point: ExplosionPoint, hue: number, pointIndex = 0) => {
      const strandCount = randomInt(120, 165)
      const accentHue = baseHue + randomBetween(12, 34)

      for (let index = 0; index < strandCount; index += 1) {
        const ratio = index / strandCount
        const spread = (ratio - 0.5) * randomBetween(0.72, 1.05)
        const angle = -Math.PI / 2 + spread + randomBetween(-0.045, 0.045)
        const speed = randomBetween(0.45, 1.35) * (1 - Math.abs(ratio - 0.5) * 0.18)
        createParticle(point.x, point.y, angle, speed, index % 4 === 0 ? accentHue : hue, 'waterfall', point.burstScale)
      }

      const crownCount = randomInt(26, 42)
      for (let index = 0; index < crownCount; index += 1) {
        const angle = randomBetween(-Math.PI * 0.95, -Math.PI * 0.05)
        createParticle(point.x, point.y, angle, randomBetween(0.35, 0.9), accentHue + pointIndex * 3, 'waterfall', point.burstScale * 0.7)
      }
    }

    if (rocket.type === 'waterfall') {
      createWaterfallBurst({ x: rocket.x, y: rocket.y, burstScale: rocket.burstScale }, baseHue, 0)

      return
    }

    if (rocket.type === 'text') {
      const message = randomItem(textFireworkMessages)
      const textScale = clamp(rocket.burstScale * 0.52, 0.32, 0.58)
      const textPoints = getTextPoints(message, textScale)

      for (const point of textPoints) {
        const targetX = rocket.x + point.x
        const targetY = rocket.y + point.y
        const dx = targetX - rocket.x
        const dy = targetY - rocket.y
        const distance = Math.max(Math.hypot(dx, dy), 1)
        const speed = clamp(distance / 20, 0.8, 5.2)
        createParticle(
          rocket.x,
          rocket.y,
          Math.atan2(dy, dx),
          speed,
          baseHue + (point.x > 0 ? 24 : 0),
          rocket.type,
          1,
        )
      }

      return
    }

    if (rocket.type === 'ring') {
      const count = randomInt(76, 118)
      const speed = randomBetween(4.4, 6.2)

      for (let index = 0; index < count; index += 1) {
        createParticle(rocket.x, rocket.y, (Math.PI * 2 * index) / count, speed, baseHue, rocket.type, rocket.burstScale)
      }

      return
    }

    if (rocket.type === 'palm') {
      const branches = randomInt(9, 14)

      for (let index = 0; index < branches; index += 1) {
        const angle = -Math.PI + (Math.PI * 2 * index) / branches + randomBetween(-0.08, 0.08)

        for (let depth = 0; depth < 7; depth += 1) {
          createParticle(
            rocket.x,
            rocket.y,
            angle + randomBetween(-0.05, 0.05),
            randomBetween(3.2, 7.4) - depth * 0.28,
            baseHue + depth * 3,
            rocket.type,
            rocket.burstScale,
          )
        }
      }

      return
    }

    const countByType: Record<Exclude<FireworkType, 'ring' | 'palm' | 'heart' | 'star' | 'multistage' | 'gradient' | 'grandShell' | 'clusterBomb' | 'waterfall' | 'text'>, [number, number]> = {
      chrysanthemum: [110, 170],
      peony: [130, 190],
      willow: [90, 140],
      crackle: [120, 180],
    }

    if (rocket.type === 'heart') {
      const count = randomInt(80, 120)
      const heartPoints = getHeartPoints(count, rocket.burstScale * 3.5)
      for (const point of heartPoints) {
        createParticle(rocket.x, rocket.y, point.angle, point.speed * 0.5 + randomBetween(1.2, 2.5), baseHue, rocket.type, 1)
      }
      return
    }

    if (rocket.type === 'star') {
      const rays = randomInt(8, 14)
      const points = getStarPoints(rays * 5, rocket.burstScale * 3)
      for (const point of points) {
        createParticle(rocket.x, rocket.y, point.angle, point.speed + randomBetween(3, 6), baseHue + randomBetween(-20, 20), rocket.type, 1)
      }
      const outerRays = randomInt(6, 10)
      for (let i = 0; i < outerRays; i++) {
        const angle = (i / outerRays) * Math.PI * 2 + randomBetween(-0.1, 0.1)
        for (let d = 0; d < 4; d++) {
          createParticle(
            rocket.x,
            rocket.y,
            angle,
            randomBetween(4.5, 7.5) - d * 0.4,
            baseHue + d * 15,
            rocket.type,
            1,
          )
        }
      }
      return
    }

    if (rocket.type === 'multistage') {
      const count = randomInt(100, 150)
      for (let index = 0; index < count; index += 1) {
        const angle = randomBetween(0, Math.PI * 2)
        const normalized = Math.sqrt(Math.random())
        const speed = normalized * randomBetween(3, 7.5)
        createParticle(rocket.x, rocket.y, angle, speed, baseHue, rocket.type, rocket.burstScale)
      }
      return
    }

    if (rocket.type === 'gradient') {
      const count = randomInt(100, 160)
      for (let index = 0; index < count; index += 1) {
        const angle = randomBetween(0, Math.PI * 2)
        const normalized = Math.sqrt(Math.random())
        const speed = normalized * randomBetween(2.5, 8)
        const distRatio = normalized
        const hueOffset = distRatio * 80
        createParticle(rocket.x, rocket.y, angle, speed, baseHue + hueOffset, rocket.type, rocket.burstScale)
      }
      return
    }

    const [minCount, maxCount] = countByType[rocket.type]
    const count = randomInt(minCount, maxCount)

    for (let index = 0; index < count; index += 1) {
      const angle = randomBetween(0, Math.PI * 2)
      const normalized = Math.sqrt(Math.random())
      const speed = normalized * randomBetween(2.4, rocket.type === 'willow' ? 7.2 : 8.8)

      createParticle(rocket.x, rocket.y, angle, speed, baseHue, rocket.type, rocket.burstScale)
    }
  }

  const fadeSky = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(2, 4, 11, 0.23)'
    ctx.fillRect(0, 0, width, height)
  }

  const createTrail = (rocket: Rocket) => {
    const count = Math.floor(randomBetween(2, 5))

    for (let index = 0; index < count; index += 1) {
      trailSparks.push({
        x: rocket.x + randomBetween(-2, 2),
        y: rocket.y + randomBetween(0, 8),
        vx: randomBetween(-0.45, 0.45),
        vy: randomBetween(0.8, 1.8),
        alpha: randomBetween(0.34, 0.72),
        radius: randomBetween(1.1, 2.6),
        hue: rocket.hue + randomBetween(-10, 12),
      })
    }
  }

  const updateRocket = (rocket: Rocket) => {
    if (rocket.life < 0) {
      rocket.life += 1
      return true
    }

    rocket.previousX = rocket.x
    rocket.previousY = rocket.y
    rocket.x += rocket.vx
    rocket.y += rocket.vy
    rocket.vx += randomBetween(-0.025, 0.025)
    if (rocket.vy > -2) {
      rocket.vy += 0.08
    } else {
      rocket.vy += 0.025
    }
    rocket.life += 1

    createTrail(rocket)

    if (rocket.life >= 200) {
      return false
    }

    const distanceToTarget = Math.hypot(rocket.targetX - rocket.x, rocket.targetY - rocket.y)
    const heightReached = rocket.y <= rocket.targetY
    const horizontalClose = Math.abs(rocket.targetX - rocket.x) < 60
    // 安全网:火箭即将飞出屏幕也立刻爆炸,避免在屏幕外不可见地爆炸。
    const offScreen = rocket.x < 60 || rocket.x > width - 60
    // 漂移安全网:飞行过久但离目标不远时强制爆炸,避免火箭"遛街"
    const driftingTooLong = rocket.life > 140 && distanceToTarget < 200
    const reachedTarget = distanceToTarget <= 28 || (heightReached && horizontalClose) || offScreen || driftingTooLong

    if (reachedTarget) {
      rocket.x = rocket.targetX
      rocket.y = rocket.targetY
    }

    return !reachedTarget
  }

  const drawRocket = (ctx: CanvasRenderingContext2D, rocket: Rocket) => {
    const gradient = ctx.createLinearGradient(rocket.previousX, rocket.previousY, rocket.x, rocket.y)

    gradient.addColorStop(0, `hsla(${rocket.hue}, 100%, 62%, 0)`)
    gradient.addColorStop(1, `hsla(${rocket.hue}, 100%, 72%, 0.95)`)

    ctx.globalCompositeOperation = 'lighter'
    ctx.lineWidth = 2.2
    ctx.strokeStyle = gradient
    ctx.beginPath()
    ctx.moveTo(rocket.previousX, rocket.previousY)
    ctx.lineTo(rocket.x, rocket.y)
    ctx.stroke()

    ctx.fillStyle = `hsla(${rocket.hue}, 100%, 82%, 0.95)`
    ctx.beginPath()
    ctx.arc(rocket.x, rocket.y, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }

  const updateTrailSpark = (spark: TrailSpark) => {
    spark.x += spark.vx
    spark.y += spark.vy
    spark.vy += 0.028
    spark.alpha *= 0.92
    spark.radius *= 0.985

    return spark.alpha > 0.025 && spark.radius > 0.25
  }

  const drawTrailSpark = (ctx: CanvasRenderingContext2D, spark: TrailSpark) => {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = `hsla(${spark.hue}, 100%, 64%, ${spark.alpha})`
    ctx.beginPath()
    ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const updateParticle = (particle: Particle) => {
    particle.previousX = particle.x
    particle.previousY = particle.y
    particle.vx *= particle.friction
    particle.vy *= particle.friction
    particle.vy += particle.gravity
    particle.x += particle.vx
    particle.y += particle.vy
    particle.age += 1

    // 文字烟花两阶段衰减:前 80 帧慢衰减(文字可读),之后加速消散
    if (particle.isText && particle.age > 80) {
      particle.decay = particle.textPhaseDecay
    }

    particle.alpha -= particle.decay

    if (particle.subExplosionDelay > 0) {
      particle.subExplosionDelay -= 1
      if (particle.subExplosionDelay === 0 && !particle.subExplosionDone) {
        particle.subExplosionDone = true
        const subCount = particle.subExplosionType === 'cluster' ? randomInt(14, 24) : randomInt(8, 14)
        for (let i = 0; i < subCount; i++) {
          const angle = randomBetween(0, Math.PI * 2)
          const speed = particle.subExplosionType === 'cluster' ? randomBetween(1.2, 5.2) : randomBetween(1.5, 4)
          trailSparks.push({
            x: particle.x,
            y: particle.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: particle.subExplosionType === 'cluster' ? randomBetween(0.62, 1) : randomBetween(0.5, 0.9),
            radius: particle.subExplosionType === 'cluster' ? randomBetween(1.2, 3.4) : randomBetween(1.5, 3),
            hue: particle.hue + randomBetween(-30, 30),
          })
        }

        if (particle.subExplosionType === 'cluster') {
          for (let i = 0; i < 5; i += 1) {
            particles.push({
              x: particle.x,
              y: particle.y,
              previousX: particle.x,
              previousY: particle.y,
              vx: randomBetween(-1.2, 1.2),
              vy: randomBetween(-1.2, 1.2),
              hue: particle.hue + randomBetween(-36, 36),
              alpha: randomBetween(0.72, 1),
              decay: randomBetween(0.022, 0.034),
              radius: randomBetween(1.1, 1.9),
              gravity: randomBetween(0.025, 0.06),
              friction: randomBetween(0.94, 0.972),
              shimmer: randomBetween(0.08, 0.2),
              crackle: true,
              subExplosionDelay: 0,
              subExplosionDone: false,
              subExplosionType: 'none',
              age: 0,
              isText: false,
              textPhaseDecay: 0,
            })
          }
        }
      }
    }

    if (particle.x < 6 || particle.x > width - 6) {
      particle.x = clamp(particle.x, 6, width - 6)
      particle.previousX = clamp(particle.previousX, 6, width - 6)
      particle.vx *= -0.12
      particle.alpha *= 0.68
    }

    if (particle.crackle && particle.alpha < 0.55 && Math.random() < 0.035) {
      trailSparks.push({
        x: particle.x,
        y: particle.y,
        vx: randomBetween(-1.6, 1.6),
        vy: randomBetween(-1.6, 1.6),
        alpha: randomBetween(0.22, 0.5),
        radius: randomBetween(0.8, 1.8),
        hue: particle.hue + randomBetween(-24, 24),
      })
    }

    return particle.alpha > 0.02
  }

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    const visibleAlpha =
      Math.random() < particle.shimmer ? particle.alpha * randomBetween(0.28, 0.72) : particle.alpha
    const gradient = ctx.createLinearGradient(particle.previousX, particle.previousY, particle.x, particle.y)

    gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 58%, 0)`)
    gradient.addColorStop(1, `hsla(${particle.hue}, 100%, 68%, ${visibleAlpha})`)

    ctx.globalCompositeOperation = 'lighter'
    ctx.lineWidth = particle.radius
    ctx.strokeStyle = gradient
    ctx.beginPath()
    ctx.moveTo(particle.previousX, particle.previousY)
    ctx.lineTo(particle.x, particle.y)
    ctx.stroke()

    ctx.fillStyle = `hsla(${particle.hue}, 100%, 72%, ${visibleAlpha * 0.65})`
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.radius * 0.58, 0, Math.PI * 2)
    ctx.fill()
  }

  const limitParticles = () => {
    const maxParticles = 3400
    const maxTrailSparks = 5000

    if (particles.length > maxParticles) {
      particles.splice(0, particles.length - maxParticles)
    }

    if (trailSparks.length > maxTrailSparks) {
      trailSparks.splice(0, trailSparks.length - maxTrailSparks)
    }
  }

  const render = () => {
    if (context) {
      fadeSky(context)

      for (let index = rockets.length - 1; index >= 0; index -= 1) {
        const rocket = rockets[index]

        if (!updateRocket(rocket)) {
          explode(rocket)
          onExplode?.(rocket.type, rocket.burstScale, {
            x: rocket.x,
            y: rocket.y,
            width,
            height,
          })
          if (SPECIAL_LOCK_TYPES.includes(rocket.type)) {
            unlockTimerId = setTimeout(() => {
              isLocked = false
              unlockTimerId = null
            }, SPECIAL_UNLOCK_DELAY)
          }
          rockets.splice(index, 1)
          continue
        }

        drawRocket(context, rocket)
      }

      for (let index = trailSparks.length - 1; index >= 0; index -= 1) {
        const spark = trailSparks[index]

        if (!updateTrailSpark(spark)) {
          trailSparks.splice(index, 1)
          continue
        }

        drawTrailSpark(context, spark)
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]

        if (!updateParticle(particle)) {
          particles.splice(index, 1)
          continue
        }

        drawParticle(context, particle)
      }

      limitParticles()
    }

    animationFrameId = window.requestAnimationFrame(render)
  }

  const start = () => {
    resize()
    window.addEventListener('resize', resize)
    render()
  }

  const stop = () => {
    window.removeEventListener('resize', resize)
    window.cancelAnimationFrame(animationFrameId)
    if (unlockTimerId) {
      clearTimeout(unlockTimerId)
      unlockTimerId = null
    }
  }

  return {
    launch,
    start,
    stop,
    setTheme,
    getIsLocked: () => isLocked,
  }
}
