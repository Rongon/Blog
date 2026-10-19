/**
 * 给慢版注入「快版 / 慢版」开关 —— 和快版那个是同一份 HTML 结构与同一份 CSS。
 *
 * 【为什么要在部署时注入，而不是改 v0-naive 的源码】
 * 慢版必须是那个 tag 的真实构建产物 —— 一个字符都不改，才敢说「这就是优化前的代码」。
 * 但那个 tag 是历史，不能回改；而它里面本来只有一个「← 回到快版」的位置都没有。
 * 于是开关只活在**部署产物**里：内联的 HTML + CSS，0 个额外请求。
 *
 * 【为什么是 fixed】
 * 慢版是 SPA，页面全部由 JS 渲染进 #app，注入的节点只能落在 <body> 末尾。
 * 想让它视觉上出现在「导航栏下方右上角」而不给 body 加 padding（那会改掉首屏布局、
 * 让已经测好的数字全部作废），fixed 是唯一干净的做法。
 *
 * 【为什么链接是绝对路径而不是 ../】
 * 慢版的路由 base 是 `/Program2026/naive/`，用户点进 `/Program2026/naive/articles`
 * 之后，`../` 是相对**当前 URL** 解析的，会算成 `/Program2026/naive/` —— 还在慢版里。
 * 所以快版地址由调用方传进来，不写死在这个脚本里。
 *
 * 【样式只有一个来源】
 * 这里直接读 `src/styles/version-switch.css`，和快版 main.ts 里 import 的是同一个文件。
 * 早先的错法：快版入口在导航栏、慢版回头在右下角悬浮条 —— 结构、位置、字号全不一样，
 * 那就不叫对照实验了，读者感受到的差异会混进界面差异。
 *
 * 用法：node scripts/inject-version-switch.mjs <慢版产物目录> <快版 base>
 * 例：  node scripts/inject-version-switch.mjs naive-tree/dist /Program2026/
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CSS_FILE = join(ROOT, 'src', 'styles', 'version-switch.css')

const dir = process.argv[2]
const fastBase = process.argv[3]

if (!dir || !fastBase) {
  console.error('用法: node scripts/inject-version-switch.mjs <慢版产物目录> <快版 base>')
  process.exit(1)
}

const file = join(dir, 'index.html')

if (!existsSync(file)) {
  console.error(`找不到 ${file} —— 慢版没构建成功？`)
  process.exit(1)
}

let html = readFileSync(file, 'utf8')

if (html.includes('class="vsw"')) {
  console.log('慢版里已经有开关了，跳过')
  process.exit(0)
}

if (!html.includes('</body>')) {
  console.error('index.html 里没有 </body>，不知道插哪儿')
  process.exit(1)
}

const css = readFileSync(CSS_FILE, 'utf8')

// 结构与快版 VersionSwitch.vue 的模板逐字对应：同样两层、同样的 class、同样「快版在前」。
// 差别只有一个：高亮项。慢版高亮「慢版」，快版高亮「快版」。
const NODE = [
  '<div class="vsw" role="group" aria-label="切换快版 / 慢版">',
  `<a href="${fastBase}">快版</a>`,
  '<span class="on" aria-current="true">慢版</span>',
  '</div>',
  `<style>${css}</style>`,
].join('')

html = html.replace('</body>', `${NODE}</body>`)
writeFileSync(file, html, 'utf8')

console.log(
  `已注入快版/慢版开关 → 快版地址 ${fastBase}（${Buffer.byteLength(NODE)} 字节，0 个额外请求）`,
)
