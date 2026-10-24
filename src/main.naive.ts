import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router/index.naive'
import { useAuthStore } from './stores/auth'

/**
 * 【慢版入口】
 *
 * 和 src/main.ts 的差别只有三处，全都是「优化项没加之前」的写法：
 *   1. Element Plus 整包注册（优化项 6 之前）
 *   2. 启动时同步把登录态读回来 —— 于是 Supabase SDK 必须在入口包里（优化项 8 之前）
 *   3. 路由表用静态导入（优化项 5 之前，见 router/index.naive.ts）
 *
 * 图片走 alias 换成了 ResponsiveImage.naive.vue（优化项 2/3/4 之前）。
 * 页面结构、文案、样式和快版是同一份源码 —— 这样两版的对比才只有「性能」这一个变量。
 */

import { installElement } from './plugins/element.naive'

import './styles/tokens.scss'
import './styles/base.scss'
import './styles/article.scss'

// 快版/慢版开关是「部署层的对照工具」，不属于被优化的十项，所以两版都要有它。
// 同一份样式文件，不另写一套 —— 否则开关本身就成了两版之间的差异。
import './styles/version-switch.css'

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)
app.use(router)

installElement(app)

void useAuthStore(pinia).init()

app.mount('#app')
