type FireworkOptions = {
  canvas: HTMLCanvasElement
  onExplode?: () => void
}

type FireworkType = 'chrysanthemum' | 'peony' | 'ring' | 'willow' | 'palm' | 'crackle' | 'heart' | 'star' | 'multistage' | 'gradient'

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
}

const fireworkTypes: FireworkType[] = ['chrysanthemum', 'peony', 'ring', 'willow', 'palm', 'crackle', 'heart', 'star', 'multistage', 'gradient']

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
    const targetX = clamp(clientX + randomBetween(-64, 64), minX, maxX)
    const targetY = randomBetween(minY, maxY)
    const burstScale = getBurstScale(targetX, targetY, width, height)

    // 反推弹道:给定飞行帧数 t,在重力作用下解出能真正命中 (targetX, targetY)
    // 的初速度。原本用 angle*speed 直接指向目标,忽略了 updateRocket 里
    // 每帧叠加的重力 → vy 衰减 → y 落后、x 超调 → 火箭飞出屏幕外才爆炸。
    //   x(t) = startX + vx·t           ⇒ vx = Δx / t
    //   y(t) = startY + vy·t + ½·g·t²  ⇒ vy = Δy/t − ½·g·t
    const flightTime = randomBetween(80, 110)
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
      type: randomItem(fireworkTypes),
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

    particles.push({
      x,
      y,
      previousX: x,
      previousY: y,
      vx: Math.cos(angle) * speed * burstScale,
      vy: Math.sin(angle) * speed * burstScale,
      hue: hue + randomBetween(-18, 18),
      alpha: randomBetween(0.82, 1),
      decay: isWillow ? randomBetween(0.005, 0.009) : randomBetween(0.009, 0.018),
      radius: isPeony ? randomBetween(2.1, 3.4) : randomBetween(1.2, 2.5),
      gravity: isWillow ? randomBetween(0.08, 0.13) : randomBetween(0.035, 0.075),
      friction: isWillow ? randomBetween(0.973, 0.985) : randomBetween(0.962, 0.986),
      shimmer: randomBetween(0.012, 0.05),
      crackle: isCrackle && Math.random() > 0.45,
      subExplosionDelay: isMultistage ? randomBetween(40, 80) : 0,
      subExplosionDone: false,
    })
  }

  const explode = (rocket: Rocket) => {
    const baseHue = rocket.hue

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

    const countByType: Record<Exclude<FireworkType, 'ring' | 'palm' | 'heart' | 'star' | 'multistage' | 'gradient'>, [number, number]> = {
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
    // 弹道公式即使配合随机漂移也基本能命中目标,这里只是兜底。
    const offScreen = rocket.x < 30 || rocket.x > width - 30
    const reachedTarget = distanceToTarget <= 28 || (heightReached && horizontalClose) || offScreen

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
    particle.alpha -= particle.decay

    if (particle.subExplosionDelay > 0) {
      particle.subExplosionDelay -= 1
      if (particle.subExplosionDelay === 0 && !particle.subExplosionDone) {
        particle.subExplosionDone = true
        const subCount = randomInt(8, 14)
        for (let i = 0; i < subCount; i++) {
          const angle = randomBetween(0, Math.PI * 2)
          const speed = randomBetween(1.5, 4)
          trailSparks.push({
            x: particle.x,
            y: particle.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: randomBetween(0.5, 0.9),
            radius: randomBetween(1.5, 3),
            hue: particle.hue + randomBetween(-30, 30),
          })
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
          onExplode?.()
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
  }

  return {
    launch,
    start,
    stop,
    setTheme,
  }
}
