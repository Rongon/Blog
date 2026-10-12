import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

import './styles/tokens.scss'
import './styles/base.scss'
import './styles/article.scss'

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)
app.use(router)

// 阶段 1（naive 基线版）：Element Plus 全量引入，不做按需加载。
// 这是刻意的——按需引入会在阶段 3 作为一项优化加上去。
app.use(ElementPlus)

// 启动时把登录状态读回来（真实来源是 localStorage 里的 Supabase session）。
// 必须显式传 pinia 实例：这里不在组件里，没有「当前激活的 pinia」可用。
void useAuthStore(pinia).init()

app.mount('#app')
