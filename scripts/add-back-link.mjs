/**
 * 给慢版产物注入一条「回到快版」的浮条。
 *
 * 【为什么要在部署时注入，而不是改 v0-naive 的源码】
 * 慢版必须是那个 tag 的真实构建产物 —— 一个字符都不改，才敢说「这就是优化前的代码」。
 * 但那个 tag 是历史，不能回改，所以进去就出不来。
 * 于是这条浮条只活在**部署产物**里：内联的 HTML + CSS，0 个额外请求。
 *
 * 【为什么不用相对路径 ../】
 * 慢版的路由 base 是 `/Program2026/naive/`，用户点进 `/Program2026/naive/articles`
 * 之后，`../` 是相对**当前 URL** 解析的，会算成 `/Program2026/naive/` —— 还在慢版里。
 * 所以必须给绝对路径。快版的 base 由调用方传进来，不在这个脚本里写死。
 *
 * 用法：node scripts/add-back-link.mjs <慢版产物目录> <快版 base>
 * 例：  node scripts/add-back-link.mjs naive-tree/dist /Program2026/
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const fastBase = process.argv[3]

if (!dir || !fastBase) {
  console.error('用法: node scripts/add-back-link.mjs <慢版产物目录> <快版 base>')
  process.exit(1)
}

const file = join(dir, 'index.html')

if (!existsSync(file)) {
  console.error(`找不到 ${file} —— 慢版没构建成功？`)
  process.exit(1)
}

let html = readFileSync(file, 'utf8')

if (html.includes('id="back-fast"')) {
  console.log('已经有「回到快版」入口了，跳过')
  process.exit(0)
}

if (!html.includes('</body>')) {
  console.error('index.html 里没有 </body>，不知道插哪儿')
  process.exit(1)
}

// 配色故意跟慢版自己的报纸风一致，不引入新变量
const BAR = [
  `<a id="back-fast" href="${fastBase}">`,
  '<span aria-hidden="true">&larr;</span> 回到快版',
  '</a>',
  '<style>',
  '#back-fast{position:fixed;right:16px;bottom:16px;z-index:9999;display:inline-block;',
  'padding:9px 14px;border:1px solid #1f0909;border-radius:2px;background:#f3f2ee;color:#1f0909;',
  'font:13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
  'text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.14)}',
  '#back-fast:hover{background:#1f0909;color:#f3f2ee}',
  '</style>',
].join('')

html = html.replace('</body>', `${BAR}</body>`)
writeFileSync(file, html, 'utf8')

console.log(`已注入「回到快版」入口 → ${fastBase}（${Buffer.byteLength(BAR)} 字节，0 个额外请求）`)
