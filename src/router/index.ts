import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 阶段 1（naive 基线版）刻意使用**静态导入**，不做路由级懒加载。
 * 结果是所有页面的代码都打进同一个 bundle —— 这是后面「路由级代码分割」
 * 这一项优化的对照起点，别顺手改成 () => import()。
 */
import HomeView from '@/views/HomeView.vue'
import ArticleListView from '@/views/ArticleListView.vue'
import ArticleDetailView from '@/views/ArticleDetailView.vue'
import ProjectListView from '@/views/ProjectListView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'
import AboutView from '@/views/AboutView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import NotFoundView from '@/views/NotFoundView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: '/articles', name: 'articles', component: ArticleListView, meta: { title: '文章' } },
  {
    path: '/articles/:slug',
    name: 'article-detail',
    component: ArticleDetailView,
    meta: { title: '文章详情' },
  },
  { path: '/projects', name: 'projects', component: ProjectListView, meta: { title: '项目' } },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: ProjectDetailView,
    meta: { title: '项目详情' },
  },
  { path: '/about', name: 'about', component: AboutView, meta: { title: '关于' } },
  { path: '/login', name: 'login', component: LoginView, meta: { title: '登录' } },
  { path: '/register', name: 'register', component: RegisterView, meta: { title: '注册' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: '404' } },
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

const SITE = '曾泽龙 · 前端工程师'

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · ${SITE}` : SITE
})

export default router
