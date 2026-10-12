import { ref, watchEffect } from 'vue'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'p2026:theme'

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
  // 默认浅色：第一次访问的人都先看到「纸」的那一面（深色是可选功能，不是默认面孔）。
  // 已手动切过的人会走上面的 localStorage 分支，不受影响。
  return 'light'
}

const theme = ref<Theme>(readInitialTheme())

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', theme.value)
})

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, theme.value)
    } catch {
      /* 存不上就算了，不影响当前会话 */
    }
  }

  return { theme, toggleTheme }
}
