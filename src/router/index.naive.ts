import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 【慢版路由表：优化项 5 之前的样子】
 *
 * 快版的路由表里，除了首页之外每个页面都是 `() => import(...)`（动态导入），
 * 打包器会为每个页面切一个 chunk，访问时才下载。
 *
 * 这里全部改回静态 import：所有页面都属于入口包，用户只打开首页，
 * 也要把登录页、注册页、404 页的代码全部下载一遍。
 *
 * 路由表本身（路径、name、meta.title）和快版逐条一致 —— 慢版要的是
 * 「同一份内容、同一套结构，只有实现更旧」，不是「另一套网站」。
 */

import HomeView from '@/views/HomeView.vue'
import ArticleListView from '@/views/ArticleListView.vue'
import ArticleDetailView from '@/views/ArticleDetailView.vue'
import ProjectListView from '@/views/ProjectListView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'
import AboutView from '@/views/AboutView.vue'
import LoginView from '@/views/LoginView.vue'
import NotFoundView from '@/views/NotFoundView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { title: '首页' } },
  { path: '/articles', name: 'articles', component: ArticleListView, meta: { title: '文章' } },
  { path: '/articles/:slug', name: 'article-detail', component: ArticleDetailView, meta: { title: '文章详情' } },
  { path: '/projects', name: 'projects', component: ProjectListView, meta: { title: '项目' } },
  { path: '/projects/:slug', name: 'project-detail', component: ProjectDetailView, meta: { title: '项目详情' } },
  { path: '/about', name: 'about', component: AboutView, meta: { title: '关于' } },
  { path: '/login', name: 'login', component: LoginView, meta: { title: '登录' } },
  { path: '/register', redirect: '/login' },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: '404' } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (to.hash) {
      const id = decodeURIComponent(to.hash.slice(1))
      return { el: `#${CSS.escape(id)}`, top: 88 }
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
