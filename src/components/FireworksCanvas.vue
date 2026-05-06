<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useFireworks } from '../composables/useFireworks'
import type { ThemeId } from '../composables/useFireworks'
import { useSharedSound } from '../composables/useSharedSound'

const sound = useSharedSound()
const canvasRef = ref<HTMLCanvasElement | null>(null)

let fireworks: ReturnType<typeof useFireworks> | null = null

const launch = (clientX: number) => {
  fireworks?.launch(clientX)
  sound.playLaunch()
  // 移动端轻微触觉反馈,桌面端 navigator.vibrate 通常不存在,会静默 noop
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(15)
  }
}

const handlePointerDown = (event: PointerEvent) => {
  launch(event.clientX)
}

const setTheme = (id: ThemeId) => {
  fireworks?.setTheme(id)
}

defineExpose({ launch, setTheme, getCanvas: () => canvasRef.value })

const props = defineProps<{ initialTheme?: ThemeId }>()

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  fireworks = useFireworks({
    canvas,
    onExplode: () => sound.playExplode(),
  })
  if (props.initialTheme) fireworks.setTheme(props.initialTheme)
  fireworks.start()
})

onBeforeUnmount(() => {
  fireworks?.stop()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fireworks-canvas"
    aria-label="Fireworks stage"
    @pointerdown="handlePointerDown"
  />
</template>
