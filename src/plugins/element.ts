/**
 * Element Plus 按需引入。
 *
 * 【为什么要自己写这一层】
 * `app.use(ElementPlus)` 会把 80 多个组件全部注册到全局。
 * 打包器看到的是「所有组件都被引用了」，于是 tree-shaking（摇树）一个都摇不掉，
 * 结果就是 JS 和 CSS 全量进首屏，哪怕首页一个 Element 组件都没渲染。
 *
 * 【全站到底用了哪些】
 * 组件标签：el-button / el-pagination
 * 命令式服务：ElMessage / ElMessageBox（不是标签，是函数调用，所以不用注册，但要引样式）
 *
 * 原来还有 el-form / el-form-item / el-input —— 那是邮箱注册表单用的。
 * 邮箱登录删掉之后（只留 GitHub OAuth）这三个没有模板再用到，一并去掉。
 *
 * 【为什么没用 unplugin-vue-components】
 * 那个插件能在构建时自动补 import 和样式，更省心。
 * 但这里只有 2 个组件，手写这一层反而更小、更可控，也不用多押两个构建期依赖。
 * 以后组件变多了再换插件，代价很小。
 *
 * 【CSS 为什么必须单独引】
 * 组件样式不会自动跟着 JS 走。每个 `element-plus/es/components/<名>/style/css`
 * 会带上自己依赖的样式（比如 pagination 会顺带引入 input 和 select），
 * 所以只要引「用到的那个」，依赖链会自动补齐。
 */

import type { App } from 'vue'
import { ElButton, ElPagination } from 'element-plus'

// 组件样式（顺序无所谓，每个都会自己带上 base）
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/pagination/style/css'
// 命令式服务的样式
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

/**
 * 注册这 2 个组件。
 * 显式写名字（而不是循环取 `c.name`）是为了让 `<el-button>` 这种写法一定能解析到 ——
 * Vue 解析组件名时会先试 `el-button`，再试驼峰化的 `ElButton`。
 */
export function installElement(app: App): void {
  app.component('ElButton', ElButton)
  app.component('ElPagination', ElPagination)
}
