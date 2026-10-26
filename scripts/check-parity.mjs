/**
 * 两版一致性检查：优化后（/Blog/）与优化前（/Blog/naive/）的**静态文字**必须逐字相同。
 *
 * 为什么需要这个东西
 * ---------------
 * 这两版是「同一份源码、关掉十项优化」编出来的，目的就是拿来做对照实验。
 * 对照实验的前提是控制变量：如果哪天有人只改了一边的文案、或者某个组件
 * 在慢版里少渲染了一样东西，那两版的差别就不只是性能了 —— 读者看到的差别
 * 会被误认为「内容不同」，整个实验的说服力当场作废。
 *
 * 人眼比对不可靠，所以让机器每次都跑一遍。
 *
 * 规则
 * ----
 * 1. 逐条路由把 body 的文字抽出来，去掉评论区，压掉空白，逐字符比较。
 * 2. 额外比一份「结构签名」：标题清单、导航文字、按钮文字 —— 文字相同但结构
 *    不同（比如少了一个标题、按钮变成了链接）也能抓到。
 * 3. 评论区**允许不一致**：它读的是线上真实数据，谁先发了一条评论，两边就会
 *    不一样。这是数据差异，不是实现差异。
 * 4. 任何不一致都让脚本以退出码 1 结束 —— 在 CI 里就是「这次不发布」。
 *
 * 实现上没有加任何依赖：Node 自带 http 起静态服务，自带 WebSocket 直接讲 CDP，
 * 只靠本机/CI 上已有的 Chrome。
 *
 * 用法
 * ----
 *   node scripts/check-parity.mjs                 # 默认检查 ./dist，挂在 /Blog/ 下
 *   node scripts/check-parity.mjs dist /Blog/     # 指定产物目录与 base
 *   CHROME_PATH=... node scripts/check-parity.mjs # 手动指定浏览器
 */

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

/* ------------------------------------------------------------------ *
 * 配置
 * ------------------------------------------------------------------ */

const DIST = resolve(process.argv[2] ?? 'dist')
const BASE = (process.argv[3] ?? '/Blog/').replace(/\/?$/, '/')

/**
 * 两档视口都要比。
 *
 * 移动端不统计性能数字（这是项目一开始就定下的边界），但**功能必须都在**：
 * 窄屏下顶栏会收进「菜单」、卡片会变单列、版本开关会挪位置 —— 这些恰恰是
 * 两版最容易走偏的地方，所以移动端也要逐字比一遍。
 */
const VIEWPORTS = [
  { name: '桌面', width: 1400, height: 1000, mobile: false },
  { name: '移动', width: 390, height: 844, mobile: true },
]

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ *
 * 路由清单：固定页 + 动态页（从 content/ 里取真实的 slug，不写死）
 * ------------------------------------------------------------------ */

async function slugsOf(dir) {
  const entries = await readdir(dir).catch(() => [])
  return entries
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort()
}

async function routes() {
  // 优先检查有代表性的那两篇，再补两篇凑够覆盖；不写死 slug，内容换了照样跑
  const PRIORITY = ['first-screen-30mb-to-1mb', 'comments-optimistic']
  const posts = await slugsOf('content/posts')
  const picked = [
    ...PRIORITY.filter((s) => posts.includes(s)),
    ...posts.filter((s) => !PRIORITY.includes(s)),
  ].slice(0, 4)

  const projects = (await slugsOf('content/projects')).slice(0, 1)

  const list = [
    '/',
    '/articles',
    '/projects',
    '/about',
    '/login',
    '/register', // 会重定向到 /login，顺便验证这条重定向两边一致
    '/no-such-page', // 404 页
  ]
  for (const slug of picked) list.push(`/articles/${slug}`)
  for (const slug of projects) list.push(`/projects/${slug}`)
  return list
}

/* ------------------------------------------------------------------ *
 * 静态服务：把 dist 挂到 BASE 下，找不到文件就回退到对应子树的 index.html
 * ------------------------------------------------------------------ */

function serve() {
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(String(req.url).split('?')[0])
    if (!url.startsWith(BASE)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      return res.end('outside base')
    }
    const rel = url.slice(BASE.length)
    const isNaive = rel === 'naive' || rel.startsWith('naive/')

    let file = join(DIST, rel)
    if (rel === '' || rel.endsWith('/')) file = join(file, 'index.html')

    const ok = await stat(file)
      .then((s) => s.isFile())
      .catch(() => false)

    if (!ok) file = isNaive ? join(DIST, 'naive', 'index.html') : join(DIST, 'index.html')

    const buf = await readFile(file).catch(() => null)
    if (!buf) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      return res.end('404')
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(buf)
  })

  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port }))
  })
}

/* ------------------------------------------------------------------ *
 * 找 Chrome
 * ------------------------------------------------------------------ */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (p && existsSync(p)) return p
  return process.platform === 'win32' ? 'chrome.exe' : 'google-chrome'
}

/* ------------------------------------------------------------------ *
 * 极简 CDP 客户端
 * ------------------------------------------------------------------ */

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const fn of this.handlers.get(msg.method) ?? []) fn(msg.params)
      }
    })
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      ws.addEventListener('open', () => resolve(new Cdp(ws)))
      ws.addEventListener('error', () => reject(new Error(`CDP 连接失败：${url}`)))
    })
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, [])
    this.handlers.get(method).push(fn)
  }

  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP 超时：${method}`))
      }, 30000)
    })
  }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? '页面里抛异常')
    return r.result.value
  }

  close() {
    try {
      this.ws.close()
    } catch {
      /* 忽略 */
    }
  }
}

/* ------------------------------------------------------------------ *
 * 页面取样
 * ------------------------------------------------------------------ */

/** 抽出文字（去掉评论区）+ 结构签名。两边用同一个函数，保证口径一致。 */
const PROBE = `(() => {
  const clone = document.body.cloneNode(true)
  clone.querySelectorAll('section.comments').forEach((n) => n.remove())
  const text = (clone.textContent || '').replace(/\\s+/g, ' ').trim()

  const sig = {
    titles: [...document.querySelectorAll('h1, h2, h3')]
      .filter((n) => !n.closest('section.comments'))
      .map((n) => n.textContent.trim()),
    nav: [...document.querySelectorAll('header a, header button')].map((n) => n.textContent.trim()),
    buttons: [...document.querySelectorAll('button')]
      .filter((n) => !n.closest('section.comments') && !n.closest('header'))
      .map((n) => n.textContent.trim()),
  }
  return { text, sig, title: document.title }
})()`

/** 等应用挂载，再等文字长度连续两次不变（说明异步数据也到了） */
async function stableText(cdp) {
  for (let i = 0; i < 120; i++) {
    if (await cdp.evaluate("!!document.querySelector('#app')?.children.length")) break
    await sleep(100)
  }
  let last = -1
  for (let i = 0; i < 40; i++) {
    const len = await cdp.evaluate('document.body ? document.body.textContent.length : -1')
    if (len === last && len > 0) return
    last = len
    await sleep(250)
  }
}

async function openPage(port, localOrigin, viewport) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl)

  await cdp.send('Page.enable')
  // 视口。移动端还要开触摸 + 换 UA —— 有些样式和事件分支认的是 UA，不只是宽度。
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 3 : 1,
    mobile: viewport.mobile,
  })
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: viewport.mobile,
    maxTouchPoints: 5,
  })
  if (viewport.mobile) {
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA, platform: 'Android' })
  }

  await cdp.send('Fetch.enable', {
    patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Request' }],
  })
  cdp.on('Fetch.requestPaused', (p) => {
    const task = p.request.url.startsWith(localOrigin)
      ? cdp.send('Fetch.continueRequest', { requestId: p.requestId })
      : cdp.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' })
    task.catch(() => {})
  })

  return { cdp, target }
}

async function closePage(port, cdp, target) {
  cdp.close()
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
}

/**
 * 移动端「关键控件都能用」：主题切换、版本开关、登录入口、列表筛选、评论区。
 * 逐项点一下看有没有反应 —— 窄屏下这些控件最容易被挤掉或挡住。
 */
async function mobileControls(port, base, localOrigin) {
  const viewport = VIEWPORTS.find((v) => v.mobile)
  const { cdp, target } = await openPage(port, localOrigin, viewport)
  const out = {}
  try {
    // 先把主题重置成 light 再重载：两版共用一个 localStorage，
    // 不重置的话后跑的那次会继承上一次的开/关状态，比出来的是状态而不是实现。
    await cdp.send('Page.navigate', { url: base })
    await stableText(cdp)
    await cdp.evaluate(`(() => { try { localStorage.setItem('p2026:theme', 'light') } catch (e) {} })()`)
    await cdp.send('Page.reload')
    await stableText(cdp)

    // 主题开关：点一下，等一拍再读（toggleTheme 走的是响应式更新，不是同步改属性）
    out.themeBefore = await cdp.evaluate(`document.documentElement.getAttribute('data-theme')`)
    await cdp.evaluate(`document.querySelector('.tgl')?.click()`)
    await sleep(450)
    out.themeAfter = await cdp.evaluate(`document.documentElement.getAttribute('data-theme')`)
    out.themeLabel = await cdp.evaluate(`document.querySelector('.tgl')?.textContent.trim() ?? null`)

    // 版本开关：窄屏下是否还在、是否可点（文案本来就相反，不参与比较）
    out.switchLink = await cdp.evaluate(`(() => {
      const a = document.querySelector('.vsw a')
      if (!a) return null
      const r = a.getBoundingClientRect()
      return { href: a.getAttribute('href'), h: Math.round(r.height), clickable: r.width > 20 && r.height > 12 }
    })()`)

    // 登录入口：点一下（外部导航被拦截器挡住，页面留在原地）
    out.login = await cdp.evaluate(`(() => {
      const b = document.querySelector('.auth .in')
      if (!b) return null
      const r = b.getBoundingClientRect()
      b.click()
      return { text: b.textContent.trim(), clickable: r.width > 20 && r.height > 12 }
    })()`)
    await sleep(600)

    // 文章列表：筛选项能点、地址栏跟着变
    await cdp.send('Page.navigate', { url: `${base}articles` })
    await stableText(cdp)
    out.filterBefore = await cdp.evaluate('location.search')
    await cdp.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '技术')?.click()`)
    await sleep(500)
    out.filterAfter = await cdp.evaluate('location.search')

    // 评论区：有没有那一块，以及未登录时给的是登录入口
    const firstArticle = await cdp.evaluate(`(() => {
      const a = document.querySelector('main a[href*="/articles/"]')
      return a ? a.getAttribute('href') : null
    })()`)
    if (firstArticle) {
      await cdp.send('Page.navigate', { url: new URL(firstArticle, `${base}articles`).href })
      await stableText(cdp)
      out.comments = await cdp.evaluate(`(() => {
        const s = document.querySelector('section.comments')
        if (!s) return null
        return {
          exists: true,
          hasEditor: !!s.querySelector('textarea'),
          hasLoginCta: !!s.querySelector('button, a'),
        }
      })()`)
    }
    await sleep(200)

    return out
  } finally {
    await closePage(port, cdp, target)
  }
}

async function sample(port, url, localOrigin, viewport) {
  const { cdp, target } = await openPage(port, localOrigin, viewport)
  try {
    await cdp.send('Page.navigate', { url })
    await stableText(cdp)
    return await cdp.evaluate(PROBE)
  } finally {
    await closePage(port, cdp, target)
  }
}

/**
 * 移动端的「能不能用」冒烟：三条杠能开、菜单项齐、能进「关于」、卡片能点进详情。
 * 文字一致不等于能点 —— 这一步专门验证交互，两版都必须通过。
 */
async function mobileSmoke(port, url, localOrigin) {
  const viewport = VIEWPORTS.find((v) => v.mobile)
  const { cdp, target } = await openPage(port, localOrigin, viewport)
  try {
    await cdp.send('Page.navigate', { url })
    await stableText(cdp)

    // 窄屏：栏目条收起、三条杠可见。两条都得成立，否则就是「导航既没摆出来也没按钮」
    const header = await cdp.evaluate(`(() => {
      const n = document.querySelector('.nav')
      const b = document.querySelector('.burger')
      const cs = n ? getComputedStyle(n) : null
      return {
        navDisplay: cs ? cs.display : null,
        burgerVisible: b ? b.getBoundingClientRect().height > 0 : false,
        burgerLabel: b ? b.getAttribute('aria-label') : null,
      }
    })()`)

    const opened = await cdp.evaluate(`(() => {
      const b = document.querySelector('.burger')
      if (!b) return null
      b.click()
      return true
    })()`)
    await sleep(400)

    const menu = await cdp.evaluate(`(() => {
      const n = document.querySelector('#site-menu')
      if (!n) return null
      const cs = getComputedStyle(n)
      return {
        open: n.classList.contains('open'),
        visible: cs.display !== 'none' && n.getBoundingClientRect().height > 0,
        expanded: document.querySelector('.burger')?.getAttribute('aria-expanded') ?? null,
        links: [...n.querySelectorAll('a')].map((a) => a.textContent.trim()),
      }
    })()`)

    // 点菜单和三条杠以外的地方，应该自己收回去。
    // 注意：Vue 的 DOM 更新是异步的，点完必须等一帧再读 class，否则读到的是旧状态。
    const outsideClose = await cdp.evaluate(`(async () => {
      const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const burger = document.querySelector('.burger')
      const menuOf = () => document.querySelector('#site-menu')
      const isOpen = () => menuOf().classList.contains('open')

      if (!isOpen()) burger.click()
      await tick()
      const opened = isOpen()

      document.querySelector('h1')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await tick()
      const afterOutside = !isOpen()

      burger.click()
      await tick()
      const reopened = isOpen()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await tick()
      const afterEsc = !isOpen()

      return { opened, afterOutside, reopened, afterEsc }
    })()`)
    await sleep(200)

    // 从菜单点「关于」：这才是真正在验「手机上找得到关于」
    const clickedNav = await cdp.evaluate(`(() => {
      if (!document.querySelector('#site-menu')?.classList.contains('open')) {
        document.querySelector('.burger')?.click()
      }
      const a = [...document.querySelectorAll('#site-menu a')].find((x) => x.textContent.trim() === '关于')
      if (!a) return null
      a.click()
      return a.getAttribute('href')
    })()`)
    await stableText(cdp)

    const about = await cdp.evaluate(`({
      path: location.pathname,
      h1: document.querySelector('h1')?.textContent.trim() ?? null,
      menuClosedAfterNav: !document.querySelector('#site-menu')?.classList.contains('open'),
    })`)

    // 回首页点第一张文章卡片
    await cdp.send('Page.navigate', { url })
    await stableText(cdp)

    const clicked = await cdp.evaluate(`(() => {
      const a = document.querySelector('main a[href*="/articles/"]')
      if (!a) return null
      a.click()
      return a.getAttribute('href')
    })()`)
    await stableText(cdp)

    const after = await cdp.evaluate(`({
      path: location.pathname,
      h1: document.querySelector('h1')?.textContent.trim() ?? null,
      switchVisible: !!document.querySelector('.vsw'),
    })`)

    return { header, opened, menu, outsideClose, clickedNav, about, clicked, after }
  } finally {
    await closePage(port, cdp, target)
  }
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function firstDiff(a, b) {
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) if (a[i] !== b[i]) return i
  return -1
}

const context = (s, i) => s.slice(Math.max(0, i - 40), i + 60)

async function main() {
  const chrome = findChrome()
  const profile = await mkdtemp(join(tmpdir(), 'parity-chrome-'))
  const { server, port } = await serve()
  const localOrigin = `http://127.0.0.1:${port}`

  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--window-size=1400,1000',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )

  const devtools = await new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => reject(new Error('Chrome 启动超时（没拿到 DevTools 端口）')), 30000)
    child.stderr.on('data', (d) => {
      buf += d.toString()
      const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(buf)
      if (m) {
        clearTimeout(timer)
        resolve(Number(m[1]))
      }
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Chrome 提前退出，code=${code}`))
    })
  })

  const list = await routes()
  const base = `${localOrigin}${BASE}`
  const failures = []

  console.log(`对比 ${list.length} 条路由 × ${VIEWPORTS.length} 档视口：`)
  console.log(`  优化后 ${BASE}  ↔  优化前 ${BASE}naive/`)
  console.log(`  视口：${VIEWPORTS.map((v) => `${v.name} ${v.width}×${v.height}`).join('、')}\n`)

  for (const vp of VIEWPORTS) {
    console.log(`【${vp.name} ${vp.width}×${vp.height}】`)
    for (const route of list) {
      const tail = route.replace(/^\//, '')
      const fast = await sample(devtools, `${base}${tail}`, localOrigin, vp)
      const naive = await sample(devtools, `${base}naive/${tail}`, localOrigin, vp)

      const at = firstDiff(fast.text, naive.text)
      const sigFast = JSON.stringify(fast.sig)
      const sigNaive = JSON.stringify(naive.sig)

      if (at === -1 && sigFast === sigNaive) {
        console.log(`  [通过] ${route}`)
        continue
      }
      failures.push({ vp: vp.name, route, at, fast, naive, sigFast, sigNaive })
      console.log(`  [不一致] ${route}`)
    }
    console.log('')
  }

  // 移动端交互冒烟：文字一致 ≠ 能点。菜单、卡片跳转两版都要过。
  console.log('【移动端交互冒烟】')
  const smokeFast = await mobileSmoke(devtools, base, localOrigin)
  const smokeNaive = await mobileSmoke(devtools, `${base}naive/`, localOrigin)

  // 慢版的路由前缀多一层 /naive，比对前先抹平
  const flatten = (o) =>
    JSON.stringify(o, (k, v) =>
      typeof v === 'string' ? v.replaceAll(`${BASE}naive/`, BASE).replaceAll(`${BASE}naive`, BASE) : v
    )

  const smokeFastJson = flatten(smokeFast)
  const smokeNaiveJson = flatten(smokeNaive)

  const smokeOk =
    smokeFastJson === smokeNaiveJson &&
    smokeFast.header?.navDisplay === 'none' &&
    smokeFast.header?.burgerVisible === true &&
    smokeFast.menu?.open === true &&
    smokeFast.menu?.visible === true &&
    smokeFast.menu?.expanded === 'true' &&
    (smokeFast.menu?.links?.length ?? 0) >= 4 &&
    smokeFast.outsideClose?.opened === true &&
    smokeFast.outsideClose?.afterOutside === true &&
    smokeFast.outsideClose?.reopened === true &&
    smokeFast.outsideClose?.afterEsc === true &&
    smokeFast.about?.menuClosedAfterNav === true &&
    smokeFast.about?.h1 != null &&
    smokeFast.after?.h1 != null &&
    smokeFast.after.path.includes('/articles/')

  if (smokeOk) {
    console.log(`  [通过] 窄屏栏目条收起、三条杠可见（${smokeFast.header.burgerLabel}）`)
    console.log(`  [通过] 菜单可展开（${smokeFast.menu.links.join(' / ')}）`)
    console.log(`  [通过] 菜单可点：关于 → ${smokeFast.about.path}（跳完自动收起）`)
    console.log('  [通过] 点菜单以外的地方会收起，Esc 也收起')
    console.log(`  [通过] 卡片可点进详情：${smokeFast.after.path}`)
    console.log(`  [通过] 标题渲染：${smokeFast.after.h1}`)
  } else {
    console.log('  [不一致] 移动端交互两版不同，明细如下')
    failures.push({
      vp: '移动 · 交互',
      route: '/',
      at: -1,
      fast: { text: smokeFastJson, sig: null },
      naive: { text: smokeNaiveJson, sig: null },
      sigFast: smokeFastJson,
      sigNaive: smokeNaiveJson,
    })
  }

  // 关键控件：主题、版本开关、登录、筛选、评论区
  const controlsFast = await mobileControls(devtools, base, localOrigin)
  const controlsNaive = await mobileControls(devtools, `${base}naive/`, localOrigin)

  // 逐个字段比。版本开关的文案本来就相反（快版那边写「优化前」），不参与比较。
  const keys = ['themeBefore', 'themeAfter', 'themeLabel', 'login', 'filterAfter', 'comments']
  const ctlDiffs = keys.filter((k) => flatten(controlsFast[k]) !== flatten(controlsNaive[k]))
  // 版本开关不比「相等」，比「各自指对了对面」：
  // 优化后那一页的链接要指向 /Blog/naive/，优化前那一页要指回 /Blog/。
  // （flatten() 会把 /naive/ 前缀抹平，直接用它会把这个差异也抹掉，所以这里单独比。）
  const switchSame =
    controlsFast.switchLink?.href === `${BASE}naive/` &&
    controlsNaive.switchLink?.href === BASE &&
    controlsFast.switchLink?.h === controlsNaive.switchLink?.h &&
    controlsFast.switchLink?.clickable === controlsNaive.switchLink?.clickable
  if (!switchSame) ctlDiffs.push('switchLink')

  // 不只知道「两版一样」，还要知道「点了真有用」
  const works =
    controlsFast.themeAfter != null &&
    controlsFast.themeAfter !== controlsFast.themeBefore &&
    controlsFast.switchLink?.clickable === true &&
    controlsFast.login?.clickable === true &&
    controlsFast.filterAfter !== controlsFast.filterBefore &&
    controlsFast.comments?.exists === true

  const controlsOk = ctlDiffs.length === 0 && works && switchSame

  if (process.env.PARITY_DEBUG) {
    console.log('DEBUG fast switch:', JSON.stringify(controlsFast.switchLink))
    console.log('DEBUG naive switch:', JSON.stringify(controlsNaive.switchLink))
    console.log('DEBUG switchSame:', switchSame, 'ctlDiffs:', ctlDiffs.join(','), 'works:', works)
  }

  if (controlsOk) {
    console.log(`  [通过] 主题开关点了有用：${controlsFast.themeBefore} → ${controlsFast.themeAfter}（按钮文案变成「${controlsFast.themeLabel}」）`)
    console.log(`  [通过] 版本开关在窄屏可点（高 ${controlsFast.switchLink.h}px，指向 ${controlsFast.switchLink.href}）`)
    console.log(`  [通过] 登录入口可点（文案「${controlsFast.login.text}」）`)
    console.log(`  [通过] 列表筛选写进地址栏：${controlsFast.filterAfter}`)
    console.log(`  [通过] 评论区在，未登录时给登录入口（可输入框：${controlsFast.comments.hasEditor}）`)
  } else {
    console.log('  [不一致] 移动端关键控件有问题，明细如下')
    if (ctlDiffs.length) console.log(`    字段不一致：${ctlDiffs.join(', ')}`)
    if (!works) console.log('    并且有控件点了没反应')
    console.log(`    优化后：${flatten(controlsFast)}`)
    console.log(`    优化前：${flatten(controlsNaive)}`)
    failures.push({
      vp: '移动 · 控件',
      route: '/',
      at: -1,
      fast: { text: flatten(controlsFast), sig: null },
      naive: { text: flatten(controlsNaive), sig: null },
      sigFast: flatten(controlsFast),
      sigNaive: flatten(controlsNaive),
    })
  }
  console.log('')

  if (failures.length) {
    console.log('不一致明细：')
    for (const f of failures) {
      console.log(`\n- [${f.vp}] ${f.route}`)
      if (f.route === '/' && f.sigFast?.startsWith('{')) {
        continue
      }
      if (f.at !== -1) {
        console.log(`  文字第 ${f.at} 个字符开始不同`)
        console.log(`  优化后：…${context(f.fast.text, f.at)}…`)
        console.log(`  优化前：…${context(f.naive.text, f.at)}…`)
      }
      if (f.sigFast !== f.sigNaive) {
        const a = JSON.parse(f.sigFast)
        const b = JSON.parse(f.sigNaive)
        for (const k of Object.keys(a)) {
          if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
            console.log(`  结构签名「${k}」不同：`)
            console.log(`    优化后：${JSON.stringify(a[k])}`)
            console.log(`    优化前：${JSON.stringify(b[k])}`)
          }
        }
      }
    }
  }

  child.kill()
  server.close()
  await rm(profile, { recursive: true, force: true }).catch(() => {})

  const total = list.length * VIEWPORTS.length
  const textFail = failures.filter((f) => !(f.route === '/' && f.sigFast?.startsWith('{'))).length
  const smokeFail = failures.length - textFail

  console.log(
    failures.length
      ? `\n结果：${textFail}/${total} 条「路由×视口」文字或结构不一致${smokeFail ? '，移动端交互也不一致' : ''} —— 先修掉再发布。`
      : `\n结果：${total}/${total} 条「路由×视口」的静态文字与结构完全一致（评论区已排除），移动端交互冒烟也通过。`
  )

  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => {
  console.error(String(e?.stack ?? e))
  process.exit(1)
})
