import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import markdown from './plugins/markdown'

/**
 * 说明（重要，别在阶段 1 顺手「优化」）：
 * 阶段 1 产出的是 **naive 基线版**——刻意不做任何构建优化。
 * 这里没有代码分割配置、没有手动分包、没有预加载、没有压缩开关。
 * 这些会在阶段 3 作为「优化项」逐项加上去，才能产生真实的对比数据。
 */
export default defineConfig(({ mode }) => ({
  /**
   * GitHub Pages 把站点放在 `https://<用户名>.github.io/<仓库名>/` 这个**子路径**下，
   * 所以产物里所有以 `/` 开头的绝对路径都要带上仓库名前缀，否则全部 404。
   *
   * 只有 `--mode ghpages`（CI 里用）才切换，本地开发和 preview 保持 `/`，
   * 免得每次都要多敲一段 `/Program2026/`。
   */
  base: mode === 'ghpages' ? '/Program2026/' : '/',

  plugins: [
    vue(),
    // 自写的插件：构建时把 content/posts/*.md 编译成 JS 模块。
    // 它只在 Node 里跑，产出的是一段 HTML 字符串，不会往浏览器塞解析器。
    markdown(),
  ],
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
}))
