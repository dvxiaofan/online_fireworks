import { useSound } from './useSound'

type SoundInstance = ReturnType<typeof useSound>

let sharedInstance: SoundInstance | null = null

/**
 * 在整个应用中共享同一个 useSound 实例。
 * 不同组件多次调用都会返回同一个 ref / 同一个 AudioContext。
 *
 * 注意:此模式本质是模块级单例,在 SSR 或多 Vue 应用场景下会有泄漏。
 * 当前项目是单页 SPA,可接受。
 */
export const useSharedSound = (): SoundInstance => {
  if (!sharedInstance) {
    sharedInstance = useSound()
  }
  return sharedInstance
}
