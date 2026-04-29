type FireworkOptions = {
  canvas: HTMLCanvasElement
}

type FireworkType = 'chrysanthemum' | 'peony' | 'ring' | 'willow' | 'palm' | 'crackle'

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
}

const fireworkTypes: FireworkType[] = ['chrysanthemum', 'peony', 'ring', 'willow', 'palm', 'crackle']

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

export const useFireworks = ({ canvas }: FireworkOptions) => {
  const rockets: Rocket[] = []
  const trailSparks: TrailSpark[] = []
  const particles: Particle[] = []

  let animationFrameId = 0
  let context = canvas.getContext('2d')
  let width = 0
  let height = 0
  let pixelRatio = 1

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
    const angle = Math.atan2(targetY - startY, targetX - startX)
    const speed = randomBetween(8.6, 12.8)
    const burstScale = getBurstScale(targetX, targetY, width, height)

    rockets.push({
      x: startX,
      y: startY,
      previousX: startX,
      previousY: startY,
      targetX,
      targetY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      hue: randomBetween(0, 360),
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

    const countByType: Record<Exclude<FireworkType, 'ring' | 'palm'>, [number, number]> = {
      chrysanthemum: [110, 170],
      peony: [130, 190],
      willow: [90, 140],
      crackle: [120, 180],
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
    rocket.vy += 0.035
    rocket.life += 1

    createTrail(rocket)

    const distanceToTarget = Math.hypot(rocket.targetX - rocket.x, rocket.targetY - rocket.y)
    const reachedTargetHeight = rocket.y <= rocket.targetY
    const reachedTarget = distanceToTarget <= 18 || reachedTargetHeight || rocket.life >= 140

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

    if (particles.length > maxParticles) {
      particles.splice(0, particles.length - maxParticles)
    }
  }

  const render = () => {
    if (context) {
      fadeSky(context)

      for (let index = rockets.length - 1; index >= 0; index -= 1) {
        const rocket = rockets[index]

        if (!updateRocket(rocket)) {
          explode(rocket)
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
  }
}
