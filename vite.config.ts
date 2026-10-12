import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 说明（重要，别在阶段 1 顺手「优化」）：
 * 阶段 1 产出的是 **naive 基线版**——刻意不做任何构建优化。
 * 这里没有代码分割配置、没有手动分包、没有预加载、没有压缩开关。
 * 这些会在阶段 3 作为「优化项」逐项加上去，才能产生真实的对比数据。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
})
