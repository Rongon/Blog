/**
 * 优化项 9 · 路由预取。
 *
 * 首页渲染完之后，趁浏览器闲着，把「首页上已经露出入口的那几个页面」的
 * JS chunk 提前下载好。用户点进去时就不用再等一次网络往返。
 *
 * 【为什么用 `import()` 而不是手写 `<link rel="prefetch">`】
 * 手写要填构建后的文件名（`ArticleListView-N6JiFJnE.js` 这种带哈希的），
 * 每次构建都变。`import()` 走的是 Vite 的模块图，哈希变了它自动跟着变，
 * 不会写成一张过期清单。
 *
 * 【为什么这里**没有**文章详情页】
 * 试过一次，结果详情页的依赖把 Supabase SDK（`auth` chunk，gzip 59 KiB）
 * 一起拖了下来 —— 评论区的 `CommentSection` 静态依赖登录 store。
 * 匿名访客根本不会登录，为了「预取详情页」先下 59 KiB 是把优化项 8 的收益
 * 在空闲时又还回去了。所以详情页保持按需加载：点进去的时候本来就要评论区的
 * 依赖，那时再下不算浪费。
 */

const ROUTES = [() => import('@/views/ArticleListView.vue')]

let started = false

export function prefetchRouteChunks() {
  if (started) return
  started = true

  const run = () => {
    for (const load of ROUTES) {
      // 预取失败无所谓：正式跳转时还会重新加载一次，这里只是「先把米买回来」
      void load().catch(() => {})
    }
  }

  // 把下载排在首屏的活干完之后。requestIdleCallback 只在浏览器空闲时触发，
  // timeout 是兜底：万一一直不空闲，3 秒后也把它做掉。
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 3000 })
  } else {
    window.setTimeout(run, 1200)
  }
}
