/**
 * public 目录里的静态资源，在浏览器里怎么拼路径。
 *
 * 【为什么需要这个函数】
 * GitHub Pages 把站点放在 `https://<用户名>.github.io/<仓库名>/` 这个**子路径**下。
 * 于是构建产物里所有以 `/` 开头的绝对路径，实际都会少一层前缀：
 *   `/images/photos/a.jpg`  → 浏览器去 `https://<用户名>.github.io/images/photos/a.jpg` 找 → 404
 * 正确的地址是 `<前缀>/images/photos/a.jpg`。
 *
 * 【前缀是哪来的】
 * Vite 的 `base` 配置。本地开发是 `/`，部署到 Pages 时是 `/Program2026/`。
 * 它在构建时被注入到 `import.meta.env.BASE_URL`，所以这里可以直接读。
 *
 * 【哪些地方需要它】
 * 只用在「运行时由 JS 拼出来」的图片地址上：
 *   · 从 frontmatter 读出来的文章封面、项目缩略图
 *   · 模板里写死的照片墙和题图
 * 文章正文里的图片不归它管——那些是构建时由 Vite 插件生成的，
 * 插件在 `configResolved` 阶段就拿到了 base，会在生成 HTML 时直接补好前缀。
 */
export function asset(path: string): string {
  if (!path) return path
  // 外链、data URL 原样返回，不要画蛇添足
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path

  const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${base}${clean}`
}
