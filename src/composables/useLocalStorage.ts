import { ref, watch, type Ref } from 'vue'

/**
 * 把一个 ref 持久化到 localStorage。
 * 任何对 ref 的写入都会同步写入 localStorage。
 * 读取异常 / 解析异常时回退到 defaultValue。
 *
 * 仅支持 JSON 可序列化的值。
 */
export const useLocalStorage = <T>(key: string, defaultValue: T): Ref<T> => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null

  const read = (): T => {
    if (!storage) return defaultValue
    try {
      const raw = storage.getItem(key)
      if (raw === null) return defaultValue
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  }

  const state = ref(read()) as Ref<T>

  watch(
    state,
    (value) => {
      if (!storage) return
      try {
        storage.setItem(key, JSON.stringify(value))
      } catch {
        // 配额不足 / 隐私模式 / 等等,静默忽略
      }
    },
    { deep: true },
  )

  return state
}
