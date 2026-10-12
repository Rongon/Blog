import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'

import './styles/tokens.scss'
import './styles/base.scss'
import './styles/article.scss'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 阶段 1（naive 基线版）：Element Plus 全量引入，不做按需加载。
// 这是刻意的——按需引入会在阶段 3 作为一项优化加上去。
app.use(ElementPlus)

app.mount('#app')
