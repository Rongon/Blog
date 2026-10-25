import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import markdown from './plugins/markdown.ts'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

/**
 * 三个 build mode：
 *
 *   （默认）本地 dev / preview        base = '/'          优化后
 *   ghpages                           base = '/Blog/'     优化后，线上用
 *   naive                             base = '/Blog/naive/'  优化前
 *
 * 【为什么慢版改成「同一份源码 + 另一个 mode」，不再用 v0-naive 那个 tag】
 * 以前慢版是 tag 的构建产物 —— 代价是它的文案和结构停在了优化前的某一天，
 * 于是「快版 vs 慢版」同时差着两样东西：性能和内容。对照实验不该这样。
 * 现在两边是同一份源码，慢版只是把十项优化逐个关掉（见下面的 alias 与 markdown 选项），
 * 页面上的字、结构、样式完全一致，唯一的变量就是「优化加没加」。
 */
export default defineConfig(({ mode }) => {
  const naive = mode === 'naive'

  const base = mode === 'ghpages' ? '/Blog/' : naive ? '/Blog/naive/' : '/'

  return {
    /**
     * GitHub Pages 把站点放在 `https://<用户名>.github.io/<仓库名>/` 这个**子路径**下，
     * 所以产物里所有以 `/` 开头的绝对路径都要带上仓库名前缀，否则全部 404。
     */
    base,

    plugins: [
      vue(),
      // 自写的插件：构建时把 content/posts/*.md 编译成 JS 模块。
      // 它只在 Node 里跑，产出的是一段 HTML 字符串，不会往浏览器塞解析器。
      // naive: true 时不生成 srcset/sizes/懒加载，图片指回原图。
      markdown({ naive }),
    ],

    resolve: {
      alias: [
        // 慢版把响应式图片组件换成「一个 img + 原图」的实现。
        // 用精确正则，只命中这一个 import 说明符，不影响别的路径。
        ...(naive
          ? [
              {
                find: /^@\/components\/ResponsiveImage\.vue$/,
                replacement: fileURLToPath(new URL('./src/components/ResponsiveImage.naive.vue', import.meta.url)),
              },
              {
                find: /^@\/components\/VersionSwitch\.vue$/,
                replacement: fileURLToPath(new URL('./src/components/VersionSwitch.naive.vue', import.meta.url)),
              },
            ]
          : []),
        { find: '@', replacement: srcDir },
      ],
    },

    // 慢版用另一个 HTML 入口（没有 preload 那两条 link），产物也放到另一个目录，
    // 免得和快版的 dist 互相覆盖。
    build: naive
      ? {
          outDir: 'dist-naive',
          rollupOptions: {
            input: fileURLToPath(new URL('./index.naive.html', import.meta.url)),
          },
        }
      : {},

    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
  }
})
