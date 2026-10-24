import type { App } from 'vue'

/**
 * 【这是「慢版」专用的 Element Plus 安装方式】
 *
 * 整包注册 —— 也就是优化项 6 之前的样子：80 多个组件全部进包，
 * 用不用得上都算在首屏里。慢版存在的意义就是带着这一身重量跑一遍。
 *
 * 快版用的是 src/plugins/element.ts（只装 5 个组件）。
 */

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

export function installElement(app: App): void {
  app.use(ElementPlus)
}
