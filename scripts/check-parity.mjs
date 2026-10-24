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

/**
 * 在一张新标签页里打开 url，取回文字与结构签名。
 *
 * 装一个文档级拦截器：把「发往本机以外的文档请求」全部 fail 掉。
 * 为什么需要 —— `/login` 的职责就是把你送去 GitHub，不拦的话两次抽样会分别落到
 * GitHub 的不同页面上（一次登录页、一次错误页），比出来的东西毫无意义。
 * 拦掉之后页面停在自己的登录模块上，两版比的才是同一个界面。
 */
async function sample(port, url, localOrigin) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl)
  try {
    await cdp.send('Page.enable')
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Request' }],
    })
    cdp.on('Fetch.requestPaused', (p) => {
      const task = p.request.url.startsWith(localOrigin)
        ? cdp.send('Fetch.continueRequest', { requestId: p.requestId })
        : cdp.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Aborted' })
      task.catch(() => {})
    })

    await cdp.send('Page.navigate', { url })
    await stableText(cdp)
    return await cdp.evaluate(PROBE)
  } finally {
    cdp.close()
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
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

  console.log(`对比 ${list.length} 条路由：${BASE}（优化后） ↔ ${BASE}naive/（优化前）\n`)

  for (const route of list) {
    const tail = route.replace(/^\//, '')
    const fast = await sample(devtools, `${base}${tail}`, localOrigin)
    const naive = await sample(devtools, `${base}naive/${tail}`, localOrigin)

    const at = firstDiff(fast.text, naive.text)
    const sigFast = JSON.stringify(fast.sig)
    const sigNaive = JSON.stringify(naive.sig)

    if (at === -1 && sigFast === sigNaive) {
      console.log(`  [通过] ${route}`)
      continue
    }
    failures.push({ route, at, fast, naive, sigFast, sigNaive })
    console.log(`  [不一致] ${route}`)
  }

  if (failures.length) {
    console.log('\n不一致明细：')
    for (const f of failures) {
      console.log(`\n- ${f.route}`)
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

  console.log(
    failures.length
      ? `\n结果：${failures.length}/${list.length} 条路由不一致 —— 两版的差异不只是性能，先修掉再发布。`
      : `\n结果：${list.length}/${list.length} 条路由的静态文字与结构完全一致（评论区已排除）。`
  )

  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => {
  console.error(String(e?.stack ?? e))
  process.exit(1)
})
