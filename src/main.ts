import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

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

// 阶段 3 · 优化项 8：这里原来有一句 `void useAuthStore(pinia).init()`，
// 意思是「不管当前页面用不用得上登录态，启动时都要问一次服务器」。
// 那句话的代价是 Supabase 客户端被静态依赖拖进入口包，首页白白多下载 80 KiB。
// 现在初始化搬进了 `components/AuthMenu.vue`：谁渲染它，谁负责初始化。

app.mount('#app')
