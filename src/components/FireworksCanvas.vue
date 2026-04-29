<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useFireworks } from '../composables/useFireworks'
import { useSound } from '../composables/useSound'

const sound = useSound()
const canvasRef = ref<HTMLCanvasElement | null>(null)

let fireworks: ReturnType<typeof useFireworks> | null = null

const handleClick = (event: MouseEvent) => {
  fireworks?.launch(event.clientX)
  sound.playLaunch()
}

onMounted(() => {
  const canvas = canvasRef.value

  if (!canvas) {
    return
  }

  fireworks = useFireworks({
    canvas,
    onExplode: () => sound.playExplode(),
  })
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
    @click="handleClick"
  />
</template>