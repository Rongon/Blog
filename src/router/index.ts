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
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

const SITE = '曾泽龙 · 前端工程师'

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · ${SITE}` : SITE
})

export default router
