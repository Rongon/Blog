import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

// 按需引入：这一句必须在样式之前 —— 它内部会引 Element Plus 各组件的 CSS，
// 而下面的 tokens.scss 要覆盖 `--el-*` 变量，顺序反了覆盖就会失效。
import { installElement } from './plugins/element'

import './styles/tokens.scss'
import './styles/base.scss'
import './styles/article.scss'

const app = createApp(App)

const pinia = createPinia()

app.use(pinia)
app.use(router)

// 阶段 3 · 优化项 6：不再 `app.use(ElementPlus)` 全量注册，改成只装用到的 5 个组件。
// （阶段 1 是全量引入，那是刻意留的 naive 基线。）
installElement(app)

// 启动时把登录状态读回来（真实来源是 localStorage 里的 Supabase session）。
// 必须显式传 pinia 实例：这里不在组件里，没有「当前激活的 pinia」可用。
void useAuthStore(pinia).init()

app.mount('#app')
