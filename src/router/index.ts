import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 【优化项 5 · 路由级代码分割】
 *
 * 这里原来是一排静态 `import HomeView from '@/views/HomeView.vue'`。
 * 静态导入的意思是「这个模块属于入口包」，于是所有页面的代码都被打进同一个
 * bundle —— 用户只打开首页，却要下载登录页、注册页、404 页的全部代码。
 *
 * 改成 `() => import(...)` 之后就变成动态导入：
 *   · 打包器看到动态 import，会为每个页面单独切出一个 chunk
 *   · 这些 chunk 在路由被访问时才下载（Vue Router 会 await 这个函数）
 *   · 副作用是首屏少下载一批代码，但切页面时会多一次网络请求
 *
 * 为什么不全都拆：首页是入口，拆出去只会多一次往返，所以它仍然是静态导入。
 */

// 唯一保留的静态导入：首页必须在入口包里，否则打开站点要多等一个请求
import HomeView from '@/views/HomeView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: '/articles', name: 'articles', component: () => import('@/views/ArticleListView.vue'), meta: { title: '文章' } },
  {
    path: '/articles/:slug',
    name: 'article-detail',
    component: () => import('@/views/ArticleDetailView.vue'),
    meta: { title: '文章详情' },
  },
  { path: '/projects', name: 'projects', component: () => import('@/views/ProjectListView.vue'), meta: { title: '项目' } },
  {
    path: '/projects/:slug',
    name: 'project-detail',
    component: () => import('@/views/ProjectDetailView.vue'),
    meta: { title: '项目详情' },
  },
  { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue'), meta: { title: '关于' } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登录' } },
  // 邮箱注册已经删掉了，但旧链接和搜索结果里可能还留着 /register，别让它变成 404
  { path: '/register', redirect: '/login' },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: '404' } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    // 站内锚点（文章目录）优先。这里必须显式处理，否则会被下面的 { top: 0 } 吃掉：
    // 点目录其实是一次「同一路由、只换了 hash」的导航，Vue Router 会当成导航执行滚动，
    // 于是页面被拉回顶部，看起来就像「点了没反应」。
    if (to.hash) {
      const id = decodeURIComponent(to.hash.slice(1))
      // top: 88 是给顶栏留出的高度。
      // 注意：这里必须显式给 top —— Vue Router 是自己算坐标再 window.scrollTo，
      // 它**不吃** CSS 的 scroll-margin-top（那个只对原生锚点跳转和 scrollIntoView 生效）。
      // 我们也确实不建议写 scroll-margin-top，免得以后有人以为它在起作用。
      return { el: `#${CSS.escape(id)}`, top: 88, behavior: 'smooth' }
    }
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

const SITE = "Rongon's blog"

/**
 * 【慢版的深链接为什么需要这一段】
 *
 * 慢版（v0-naive 的构建产物）部署在 `/naive/` 子路径下，它是**另一个** SPA，
 * 有自己的 base、自己的路由。点着走没问题，但直接打开 /naive/articles
 * 这种地址会坏：
 *
 *   GitHub Pages 是纯静态服务器，全站只有一个 404.html —— 就是主站那份
 *   （workflow 里 `cp dist/index.html dist/404.html`）。所以任何 404 都会
 *   先把**主站**加载起来，再由主站的 Vue Router 去看这个路径。
 *   于是 `/naive/articles` 在主站路由表里匹配不上，落到 404 页。
 *
 * 主站对 `/naive/...` 本来就一无所知，与其给一句「页面不存在」，
 * 不如把它送回慢版首页。硬跳转（location.replace）而不是 push：
 * 慢版是另一个应用，交给浏览器重新加载更干净，也不会在主站历史里留一条。
 */
router.beforeEach((to) => {
  // 只处理「慢版根目录之外」的路径，精确的 `/naive/` 放过去。
  // 为什么非要排除它：本地 `pnpm dev` 的 base 是 `/`，Vite 对任何没有扩展名的
  // 路径都回退到 index.html，于是 `/naive/` 也会被主站接下 ——
  // 如果不排除，就会出现「主站 → 跳 /naive/ → 还是主站 → 再跳」的死循环。
  // 线上不会有这个问题（`/naive/` 是真实存在的文件，轮不到 404 回退），
  // 但本地开发会，所以要在这里挡一下。
  const isNaive = to.path === '/naive' || (to.path.startsWith('/naive/') && to.path !== '/naive/')
  if (isNaive) {
    window.location.replace(`${import.meta.env.BASE_URL}naive/`)
    return false
  }
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · ${SITE}` : SITE
})

export default router
