<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import FireworksCanvas from './components/FireworksCanvas.vue'
import SoundToggle from './components/SoundToggle.vue'
import { useLocalStorage } from './composables/useLocalStorage'
import { useSharedSound } from './composables/useSharedSound'
import { THEMES, type ThemeId } from './composables/useFireworks'

const sound = useSharedSound()
const soundEnabled = sound.enabled

// 持久化:首次加载时读取
const persistedSound = useLocalStorage('fw:soundEnabled', false)
const persistedAuto = useLocalStorage('fw:autoMode', false)
const persistedTheme = useLocalStorage<ThemeId>('fw:theme', 'default')

const fireworksRef = ref<InstanceType<typeof FireworksCanvas> | null>(null)
const autoMode = ref(persistedAuto.value)
const themeId = ref<ThemeId>(persistedTheme.value)
const themePickerOpen = ref(false)

const currentTheme = computed(
  () => THEMES.find((t) => t.id === themeId.value) ?? THEMES[0],
)

let autoInterval: number | null = null

const toggleSound = () => {
  sound.setEnabled(!soundEnabled.value)
}

// 同步 sound 状态 → 持久化
watch(soundEnabled, (value) => {
  persistedSound.value = value
})

// 同步 autoMode → 持久化
watch(autoMode, (value) => {
  persistedAuto.value = value
})

// 同步 theme → fireworks 引擎 + 持久化
watch(themeId, (id) => {
  fireworksRef.value?.setTheme(id)
  persistedTheme.value = id
})

const launchRandom = () => {
  const stage = fireworksRef.value
  if (!stage) return
  const x = window.innerWidth * (0.2 + Math.random() * 0.6)
  stage.launch(x)
}

const startAutoFire = () => {
  if (autoInterval) return
  autoInterval = window.setInterval(launchRandom, 1200)
}

const stopAutoFire = () => {
  if (autoInterval) {
    clearInterval(autoInterval)
    autoInterval = null
  }
}

const toggleAutoMode = () => {
  autoMode.value = !autoMode.value
  if (autoMode.value) startAutoFire()
  else stopAutoFire()
}

const captureScreenshot = () => {
  const canvas = fireworksRef.value?.getCanvas()
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    a.href = url
    a.download = `fireworks_${ts}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

const selectTheme = (id: ThemeId) => {
  themeId.value = id
  themePickerOpen.value = false
}

// 把主题色块渲染成预览渐变
const themeSwatchGradient = (buckets: Array<[number, number]>) => {
  // 取每个 bucket 的中点 hue 作为示例色
  const stops = buckets.map((b) => {
    const hue = (b[0] + b[1]) / 2
    return `hsl(${hue}, 95%, 60%)`
  })
  if (stops.length === 1) return stops[0]
  return `linear-gradient(135deg, ${stops.join(', ')})`
}

const isFormElement = (target: EventTarget | null) =>
  target instanceof HTMLButtonElement ||
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement

const onKeyDown = (e: KeyboardEvent) => {
  if (e.repeat) return

  if (e.code === 'Space' || e.code === 'Enter') {
    if (isFormElement(e.target)) return
    e.preventDefault()
    launchRandom()
    return
  }

  if (e.code === 'KeyA') {
    if (isFormElement(e.target)) return
    toggleAutoMode()
    return
  }

  if (e.code === 'KeyS') {
    if (isFormElement(e.target)) return
    captureScreenshot()
    return
  }

  if (e.code === 'KeyT') {
    if (isFormElement(e.target)) return
    themePickerOpen.value = !themePickerOpen.value
  }
}

onMounted(() => {
  // 应用持久化:声音状态
  if (persistedSound.value) {
    sound.setEnabled(true)
  }
  // 应用持久化:自动模式(autoMode 已初始化为 persistedAuto.value)
  if (autoMode.value) startAutoFire()
  // 应用持久化:主题(FireworksCanvas 通过 prop 传入,此处无需手动)

  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopAutoFire()
  sound.dispose()
})
</script>

<template>
  <main class="app-shell" aria-label="Online Fireworks">
    <FireworksCanvas ref="fireworksRef" :initial-theme="themeId" />
    <SoundToggle :enabled="soundEnabled" @toggle="toggleSound" />
    <button
      class="auto-toggle"
      :class="{ active: autoMode }"
      aria-label="Toggle auto mode"
      title="自动模式 (A)"
      @click="toggleAutoMode"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
        />
      </svg>
    </button>
    <button
      class="screenshot-toggle"
      aria-label="Save screenshot"
      title="保存截图 (S)"
      @click="captureScreenshot"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
        />
      </svg>
    </button>
    <button
      class="theme-toggle"
      :class="{ active: themePickerOpen }"
      aria-label="Pick theme"
      :title="`主题: ${currentTheme.name} (T)`"
      @click="themePickerOpen = !themePickerOpen"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 22A10 10 0 0 1 2 12A10 10 0 0 1 12 2c5.5 0 10 4 10 9a6 6 0 0 1-6 6h-1.8c-.3 0-.5.2-.5.5c0 .1.1.2.1.3c.4.5.6 1.1.6 1.7c.1 1.4-1 2.5-2.4 2.5m0-18a8 8 0 0 0-8 8a8 8 0 0 0 8 8c.3 0 .5-.2.5-.5c0-.2-.1-.3-.1-.4c-.4-.5-.6-1-.6-1.6c0-1.4 1.1-2.5 2.5-2.5H16a4 4 0 0 0 4-4c0-3.9-3.6-7-8-7m-5.5 6c.8 0 1.5.7 1.5 1.5S7.3 13 6.5 13S5 12.3 5 11.5S5.7 10 6.5 10m3-4c.8 0 1.5.7 1.5 1.5S10.3 9 9.5 9S8 8.3 8 7.5S8.7 6 9.5 6m5 0c.8 0 1.5.7 1.5 1.5S15.3 9 14.5 9S13 8.3 13 7.5S13.7 6 14.5 6m3 4c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5z"
        />
      </svg>
    </button>
    <transition name="fade">
      <div v-if="themePickerOpen" class="theme-picker" role="menu">
        <button
          v-for="t in THEMES"
          :key="t.id"
          class="theme-option"
          :class="{ active: t.id === themeId }"
          :role="'menuitemradio'"
          :aria-checked="t.id === themeId"
          @click="selectTheme(t.id)"
        >
          <span class="theme-swatch" :style="{ background: themeSwatchGradient(t.hueBuckets) }" />
          <span>{{ t.name }}</span>
        </button>
      </div>
    </transition>
    <div class="shortcuts-hint">
      <span>A - 自动模式</span>
      <span>Space/Enter - 发射</span>
      <span>S - 截图</span>
      <span>T - 主题</span>
    </div>
  </main>
</template>

<style scoped>
.auto-toggle,
.screenshot-toggle,
.theme-toggle {
  position: fixed;
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

.auto-toggle {
  bottom: 20px;
  left: 20px;
}

.screenshot-toggle {
  bottom: 74px;
  left: 20px;
}

.theme-toggle {
  bottom: 128px;
  left: 20px;
}

.auto-toggle:hover,
.screenshot-toggle:hover,
.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
}

.auto-toggle.active,
.theme-toggle.active {
  color: rgba(100, 255, 150, 0.9);
}

.auto-toggle svg,
.screenshot-toggle svg,
.theme-toggle svg {
  width: 22px;
  height: 22px;
}

.theme-picker {
  position: fixed;
  bottom: 128px;
  left: 76px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(20, 24, 36, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  z-index: 1000;
  min-width: 130px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.15s ease;
}

.theme-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.theme-option.active {
  background: rgba(100, 255, 150, 0.12);
  color: rgba(180, 255, 200, 1);
}

.theme-swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
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
  pointer-events: none;
}

.shortcuts-hint span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

@media (max-width: 480px) {
  .shortcuts-hint {
    display: none;
  }
}
</style>
