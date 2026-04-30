<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import FireworksCanvas from './components/FireworksCanvas.vue'
import SoundToggle from './components/SoundToggle.vue'
import { useSound } from './composables/useSound'

const sound = useSound()
const soundEnabled = ref(false)
const autoMode = ref(false)

let autoInterval: number | null = null

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
  sound.setEnabled(soundEnabled.value)
}

const toggleAutoMode = () => {
  autoMode.value = !autoMode.value
  if (autoMode.value) {
    startAutoFire()
  } else {
    stopAutoFire()
  }
}

const startAutoFire = () => {
  if (autoInterval) return
  autoInterval = window.setInterval(() => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const clientX = rect.left + Math.random() * rect.width * 0.6 + rect.width * 0.2
      canvas.dispatchEvent(new MouseEvent('click', {
        clientX,
        bubbles: true,
      }))
    }
  }, 1200)
}

const stopAutoFire = () => {
  if (autoInterval) {
    clearInterval(autoInterval)
    autoInterval = null
  }
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const clientX = rect.left + Math.random() * rect.width * 0.6 + rect.width * 0.2
      canvas.dispatchEvent(new MouseEvent('click', {
        clientX,
        bubbles: true,
      }))
    }
  }
  if (e.code === 'KeyA') {
    toggleAutoMode()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopAutoFire()
})
</script>

<template>
  <main class="app-shell" aria-label="Online Fireworks">
    <FireworksCanvas />
    <SoundToggle
      :enabled="soundEnabled"
      @toggle="toggleSound"
    />
    <button
      class="auto-toggle"
      :class="{ active: autoMode }"
      aria-label="Toggle auto mode"
      @click="toggleAutoMode"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </button>
    <div class="shortcuts-hint">
      <span>A - 自动模式</span>
      <span>Space/Enter - 发射</span>
    </div>
  </main>
</template>

<style scoped>
.auto-toggle {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1000;
}

.auto-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
}

.auto-toggle.active {
  color: rgba(100, 255, 150, 0.9);
}

.auto-toggle svg {
  width: 22px;
  height: 22px;
}

.shortcuts-hint {
  position: fixed;
  bottom: 24px;
  left: 80px;
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  z-index: 1000;
}

.shortcuts-hint span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
</style>