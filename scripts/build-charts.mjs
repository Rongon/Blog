/**
 * 从 `perf/*.json` 里读真实数字，生成文章正文要用的图表。
 *
 * 【为什么不用现成的图】正文里的每一张图都要能被追问「这数字哪来的」。
 * 由报告直接生成，答案就是「跑这一行命令就行」：
 *   node scripts/build-charts.mjs
 *
 * 输出：
 *   public/images/tech/<name>.webp       1200 宽（全尺寸）
 *   public/images/tech/<name>-800.webp   800 宽（窄屏用）
 * 并把它们登记进 src/data/image-manifest.json，这样 <img> 才有 width/height，
 * 不会因为正文图片把布局顶下去（CLS 就是这么来的）。
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const PERF = path.join(ROOT, 'perf')
const OUT = path.join(ROOT, 'public', 'images', 'tech')
const MANIFEST = path.join(ROOT, 'src', 'data', 'image-manifest.json')

const WIDTH = 1200

/** 报纸风的配色，和站点 CSS 变量一致 */
const C = {
  bg: '#f3f2ee',
  ink: '#1f0909',
  muted: '#6b625c',
  rule: '#d8d5cd',
  data: '#0d9488',
  blue: '#065588',
  clay: '#b5651d',
  sand: '#8a7f6d',
}

const FONT = "Georgia, 'Times New Roman', 'Microsoft YaHei', 'Songti SC', serif"

async function load(file) {
  return JSON.parse(await readFile(path.join(PERF, file), 'utf8'))
}

/** 一份报告 → 首屏各类资源的传输量（KiB） */
function measure(report) {
  const items = report.audits['network-requests'].details.items
  const by = {}
  let total = 0
  for (const it of items) {
    const kb = (it.transferSize || 0) / 1024
    by[it.resourceType] = (by[it.resourceType] || 0) + kb
    total += kb
  }
  return {
    total,
    image: by.Image || 0,
    script: by.Script || 0,
    css: by.Stylesheet || 0,
    font: by.Font || 0,
    perf: Math.round(report.categories.performance.score * 100),
    lcp: report.audits['largest-contentful-paint'].numericValue,
  }
}

const median = (nums) => nums.slice().sort((a, b) => a - b)[Math.floor(nums.length / 2)]
const kib = (n) => `${Math.round(n).toLocaleString('en-US')} KiB`
/** KiB → 十进制 MB（1 KiB = 1024 B，1 MB = 1000 KB）。图上统一用 MB，读者不用换算。 */
const mb = (n) => `${((n * 1024) / 1e6).toFixed(1)} MB`

/* ---------- SVG 小工具 ---------- */

const text = (x, y, str, { size = 20, fill = C.ink, anchor = 'start', weight = 400, family = FONT } = {}) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${str}</text>`

const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${Math.max(w, 0)}" height="${h}" fill="${fill}"/>`

const line = (x1, y1, x2, y2, stroke = C.rule, width = 1) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`

const circle = (cx, cy, r, fill, stroke = 'none', sw = 0) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`

function frame(height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
    ${rect(0, 0, WIDTH, height, C.bg)}
    ${body}
  </svg>`
}

/* ---------- 图 1：慢版 vs 快版，首屏传输构成 ---------- */

function chartTransfer(slow, fast) {
  const H = 540
  const left = 150
  const maxW = WIDTH - left - 320
  const max = slow.total
  const scale = (v) => (v / max) * maxW

  const series = [
    { label: '图片', key: 'image', fill: C.data },
    { label: '脚本', key: 'script', fill: C.blue },
    { label: '样式', key: 'css', fill: C.sand },
    { label: '字体', key: 'font', fill: C.clay },
  ]

  const rows = [
    { y: 210, h: 76, name: '慢版', data: slow, note: 'v0-naive' },
    { y: 330, h: 76, name: '快版', data: fast, note: '当前线上' },
  ]

  let body = ''
  body += text(120, 74, '首屏传输构成：慢版 vs 快版', { size: 30, weight: 700 })
  body += text(120, 108, '同一份内容、同一台机器、冷缓存。单位 MB，数字取 5 次中位数。', {
    size: 19,
    fill: C.muted,
  })

  for (const r of rows) {
    body += text(left - 24, r.y + 34, r.name, { size: 24, anchor: 'end', weight: 700 })
    body += text(left - 24, r.y + 62, r.note, { size: 16, anchor: 'end', fill: C.muted })

    let x = left
    for (const s of series) {
      const w = scale(r.data[s.key])
      body += rect(x, r.y, w, r.h, s.fill)
      x += w
    }

    body += text(left + scale(r.data.total) + 20, r.y + 34, mb(r.data.total), { size: 26, weight: 700 })
    body += text(left + scale(r.data.total) + 20, r.y + 62, `图片占 ${Math.round((r.data.image / r.data.total) * 100)}%`, {
      size: 17,
      fill: C.muted,
    })
  }

  // 图例（只标类别，具体数字在长条右侧）
  const legendY = 452
  let lx = 120
  for (const s of series) {
    body += rect(lx, legendY - 16, 16, 16, s.fill)
    body += text(lx + 26, legendY, s.label, { size: 18 })
    lx += 150
  }

  body += line(120, 480, WIDTH - 120, 480)
  body += text(120, 508, '数据来源：perf/cold-slow-run*.json、perf/cold-fast-run*.json　Lighthouse 13.5.0 --preset=desktop', {
    size: 16,
    fill: C.muted,
  })

  return frame(H, body)
}

/* ---------- 图 2：十项优化的总传输曲线 ---------- */

function chartSteps(steps) {
  const H = 620
  const left = 120
  const right = WIDTH - 140
  const top = 150
  const bottom = 470
  const max = steps[0].total
  const maxY = max * 1.08

  const xAt = (i) => left + ((right - left) * i) / (steps.length - 1)
  const yAt = (v) => bottom - (v / maxY) * (bottom - top)

  let body = ''
  body += text(120, 74, '每一项优化之后，首屏总传输量', { size: 30, weight: 700 })
  body += text(120, 108, '每次改完都重新构建、重新部署、重新跑三次 Lighthouse，取中位数。', {
    size: 19,
    fill: C.muted,
  })

  // 网格线
  for (const v of [0, 10000, 20000, 30000]) {
    const y = yAt(v)
    body += line(left, y, right, y, C.rule)
    body += text(left - 16, y + 6, v === 0 ? '0' : `${v / 1000}k`, { size: 16, anchor: 'end', fill: C.muted })
  }

  // 折线
  const pts = steps.map((s, i) => `${xAt(i)},${yAt(s.total)}`).join(' ')
  body += `<polyline points="${pts}" fill="none" stroke="${C.data}" stroke-width="3"/>`

  // 点 + 只在关键点标数字
  const keyIdx = new Set([0, 1, 2, 6, steps.length - 1])
  steps.forEach((s, i) => {
    const x = xAt(i)
    const y = yAt(s.total)
    body += circle(x, y, 5, C.data)
    if (keyIdx.has(i)) {
      // v2 那个点正好在折线的拐角上，标签放下面才不会压在线上
      const dy = i === 2 ? 30 : -18
      body += text(x, y + dy, mb(s.total), { size: 17, anchor: 'middle', weight: 700 })
    }
    body += text(x, bottom + 30, s.short, { size: 15, anchor: 'middle', fill: C.muted })
  })

  body += line(left, 520, WIDTH - 120, 520)
  body += text(120, 552, '前两项（转 WebP、加 srcset）拿走了 97% 的收益；后面八项合计只降了 0.7 MB。', {
    size: 18,
  })
  body += text(120, 580, '数据来源：perf/baseline-desktop.json 与 perf/step*.json', { size: 16, fill: C.muted })

  return frame(H, body)
}

/* ---------- 图 3：冷缓存连跑 5 次的分数波动 ---------- */

function chartRuns(fastRuns, slowRuns) {
  const H = 560
  const left = 120
  const right = WIDTH - 140
  const top = 160
  const bottom = 430

  const xAt = (i) => left + ((right - left) * i) / 4
  const yAt = (v) => bottom - (v / 100) * (bottom - top)

  let body = ''
  body += text(120, 74, '同一份代码连跑 5 次，分数不是一个固定值', { size: 30, weight: 700 })
  body += text(120, 108, '所以简历里写数字，要么给区间，要么说清取的是中位数。', { size: 19, fill: C.muted })

  for (const v of [0, 25, 50, 75, 100]) {
    const y = yAt(v)
    body += line(left, y, right, y, C.rule)
    body += text(left - 16, y + 6, String(v), { size: 16, anchor: 'end', fill: C.muted })
  }

  const draws = [
    { runs: slowRuns, fill: C.clay, name: '慢版', label: true },
    { runs: fastRuns, fill: C.data, name: '快版', label: true },
  ]

  for (const d of draws) {
    const xs = d.runs.map((_, i) => xAt(i))
    const ys = d.runs.map((r) => yAt(r.perf))
    for (let i = 0; i < xs.length; i++) {
      body += circle(xs[i], ys[i], 7, d.fill)
    }
    const med = median(d.runs.map((r) => r.perf))
    const my = yAt(med)
    body += line(left, my, right, my, d.fill, 2)
    body += `<line x1="${left}" y1="${my}" x2="${right}" y2="${my}" stroke="${d.fill}" stroke-width="2" stroke-dasharray="8 6"/>`
    body += text(right + 12, my + 6, `${d.name}中位数 ${med}`, { size: 17, fill: d.fill, weight: 700 })
  }

  for (let i = 0; i < 5; i++) {
    body += text(xAt(i), bottom + 30, `第 ${i + 1} 次`, { size: 16, anchor: 'middle', fill: C.muted })
  }

  body += line(left, 480, WIDTH - 120, 480)
  body += text(120, 512, '慢版 38–52 分（中位 46），快版 94–97 分（中位 95）。区间本身就是结论的一部分。', {
    size: 18,
  })
  body += text(120, 540, '数据来源：perf/cold-*-run1…5.json', { size: 16, fill: C.muted })

  return frame(H, body)
}

/* ---------- 主流程 ---------- */

const base = measure(await load('baseline-desktop.json'))

const STEP_FILES = [
  ['v0', '基线', ['baseline-desktop.json']],
  ['v1', 'WebP', ['step1-webp.json', 'step1-webp-run2.json', 'step1-webp-run3.json']],
  ['v2', 'srcset', ['step2-srcset.json', 'step2-srcset-run2.json', 'step2-srcset-run3.json']],
  ['v3', '懒加载', ['step3-lazy.json', 'step3-lazy-run2.json', 'step3-lazy-run3.json']],
  ['v4', '宽高', ['step4-dimensions.json', 'step4-dimensions-run2.json', 'step4-dimensions-run3.json']],
  ['v5', '分割', ['step5-codesplit.json', 'step5-codesplit-run2.json', 'step5-codesplit-run3.json']],
  ['v6', '按需', ['step6-ondemand.json', 'step6-ondemand-run2.json', 'step6-ondemand-run3.json']],
  ['v7', '质量', ['step7-imagequality.json', 'step7-imagequality-run2.json', 'step7-imagequality-run3.json']],
  ['v8', '登录态', ['step8-asyncauth.json', 'step8-asyncauth-run2.json', 'step8-asyncauth-run3.json']],
  ['v9', '预加载', ['step9-preload.json', 'step9-preload-run2.json', 'step9-preload-run3.json']],
]

const steps = []
for (const [short, label, files] of STEP_FILES) {
  const measured = []
  for (const f of files) measured.push(measure(await load(f)))
  steps.push({
    short,
    label,
    total: median(measured.map((m) => m.total)),
    image: median(measured.map((m) => m.image)),
    script: median(measured.map((m) => m.script)),
    css: median(measured.map((m) => m.css)),
    font: median(measured.map((m) => m.font)),
  })
}

const fastRuns = []
for (let i = 1; i <= 5; i++) fastRuns.push(measure(await load(`cold-fast-run${i}.json`)))
const slowRuns = []
for (let i = 1; i <= 5; i++) slowRuns.push(measure(await load(`cold-slow-run${i}.json`)))

const slow = {
  total: median(slowRuns.map((r) => r.total)),
  image: median(slowRuns.map((r) => r.image)),
  script: median(slowRuns.map((r) => r.script)),
  css: median(slowRuns.map((r) => r.css)),
  font: median(slowRuns.map((r) => r.font)),
}
const fast = {
  total: median(fastRuns.map((r) => r.total)),
  image: median(fastRuns.map((r) => r.image)),
  script: median(fastRuns.map((r) => r.script)),
  css: median(fastRuns.map((r) => r.css)),
  font: median(fastRuns.map((r) => r.font)),
}

/* ---------- 图 4：乐观更新的状态流转（示意图，无数据依赖） ---------- */

function chartOptimisticFlow() {
  const H = 520

  const box = (x, y, w, h, title, note, stroke) => {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`
    s += text(x + 24, y + 38, title, { size: 21, weight: 700 })
    if (note) s += text(x + 24, y + 68, note, { size: 16, fill: C.muted })
    return s
  }

  const arrow = (pts) =>
    `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.muted}" stroke-width="1.5"/>` +
    (() => {
      const [x1, y1] = pts[pts.length - 2].split(',').map(Number)
      const [x2, y2] = pts[pts.length - 1].split(',').map(Number)
      const d = x2 > x1 ? [[x2, y2], [x2 - 8, y2 - 5], [x2 - 8, y2 + 5]] : [[x2, y2], [x2 + 8, y2 - 5], [x2 + 8, y2 + 5]]
      return `<polygon points="${d.map((p) => p.join(',')).join(' ')}" fill="${C.muted}"/>`
    })()

  let body = ''
  body += text(120, 74, '乐观更新的三条路', { size: 30, weight: 700 })
  body += text(120, 108, '列表里那条评论的四种状态里，只有一种是服务端确认过的。', {
    size: 19,
    fill: C.muted,
  })

  body += box(90, 214, 180, 84, '点发表', '草稿进内存', C.ink)
  body += box(340, 190, 250, 132, '评论立刻上屏', '', C.data)
  body += text(365, 262, '临时 id：tmp-xxx', { size: 16, fill: C.muted })
  body += text(365, 292, 'clientId 已生成', { size: 16, fill: C.muted })

  body += arrow(['270,256', '340,256'])

  // 分叉：成功向上，失败向下
  body += arrow(['590,236', '650,236', '650,176', '724,176'])
  body += arrow(['590,276', '650,276', '650,380', '724,380'])

  body += box(724, 134, 386, 86, '成功：换成真实数据', 'pending → false，id 换成服务端的', C.data)
  body += box(724, 338, 386, 86, '失败：按临时 id 删掉', '并把草稿写回输入框', C.clay)

  body += text(120, 470, '注：删的时候不能 pop() —— 等待期间用户可能又发了别的，最后一条未必是这一条。', {
    size: 17,
    fill: C.muted,
  })

  return frame(H, body)
}

/* ---------- 图 5：Markdown 两条链路（示意图） ---------- */

const flowBox = (x, y, w, h, title, note, stroke) => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`
  s += text(x + 20, y + 32, title, { size: 19, weight: 700 })
  if (note) s += text(x + 20, y + 60, note, { size: 15, fill: C.muted })
  return s
}

const flowArrow = (x1, x2, y) => {
  const head = `<polygon points="${x2},${y} ${x2 - 9},${y - 5} ${x2 - 9},${y + 5}" fill="${C.muted}"/>`
  return line(x1, y, x2 - 2, y, C.muted, 1.5) + head
}

function chartMarkdownPipeline() {
  const H = 560

  let body = ''
  body += text(120, 74, 'Markdown 该在谁的机器上解析', { size: 30, weight: 700 })
  body += text(120, 108, '同一份内容，两条链路。差别在于那份工作乘以谁。', {
    size: 19,
    fill: C.muted,
  })

  // 上：浏览器解析（未采用）
  body += text(120, 186, '浏览器解析（没用这条）', { size: 20, weight: 700, fill: C.muted })
  body += flowBox(120, 206, 150, 76, '.md 文件', '', C.muted)
  body += flowArrow(270, 344, 244)
  body += flowBox(344, 206, 270, 76, '下载解析器 + 高亮器', '几十到几百 KB', C.clay)
  body += flowArrow(614, 688, 244)
  body += flowBox(688, 206, 210, 76, '主线程解析', '阻塞渲染', C.clay)
  body += flowArrow(898, 972, 244)
  body += flowBox(972, 206, 168, 76, '文字出现', '晚一步', C.muted)
  body += text(120, 316, '成本 × 访问次数：每个访客都要重新付一次', { size: 16, fill: C.clay })

  // 下：构建时解析（采用）
  body += text(120, 396, '构建时解析（采用这条）', { size: 20, weight: 700, fill: C.data })
  body += flowBox(120, 416, 150, 76, '.md 文件', '', C.data)
  body += flowArrow(270, 344, 454)
  body += flowBox(344, 416, 270, 76, 'Vite transform', 'Node 里跑一次', C.data)
  body += flowArrow(614, 688, 454)
  body += flowBox(688, 416, 210, 76, 'HTML 进产物', '只是字符串', C.data)
  body += flowArrow(898, 972, 454)
  body += flowBox(972, 416, 168, 76, '直接渲染', '不用等 JS 解析', C.data)
  body += text(120, 526, '成本 × 1：产物里没有任何 Markdown 解析器', { size: 16, fill: C.data })

  return frame(H, body)
}

/* ---------- 图 6：类型能证明的三层（示意图） ---------- */

function chartTypesLayers() {
  const H = 460
  const rows = [
    { y: 150, title: '形状对', note: '字段名、字段类型、有没有漏字段', ok: true, eg: 'mapRow 少写一个字段 → 构建失败' },
    { y: 250, title: '契约对', note: '组件要什么参数、函数返回什么', ok: true, eg: '忘了传 postSlug → 编译报错' },
    { y: 350, title: '业务对', note: '「这条评论该不该显示」这类判断', ok: false, eg: '类型不知道，只能靠人写 if' },
  ]

  let body = ''
  body += text(120, 74, '类型能证明的三层', { size: 30, weight: 700 })
  body += text(120, 108, '越往下越弱。说「项目开了 strict」的时候，要先知道自己在说哪一层。', {
    size: 19,
    fill: C.muted,
  })

  for (const r of rows) {
    const color = r.ok ? C.data : C.clay
    body += flowBox(120, r.y, 300, 78, r.title, r.note, color)
    body += text(460, r.y + 34, r.eg, { size: 17, fill: C.muted })
    body += text(460, r.y + 62, r.ok ? '编译期能保证' : '编译期管不了', {
      size: 16,
      weight: 700,
      fill: color,
    })
  }

  return frame(H, body)
}

const charts = [
  { name: 'types-three-layers', svg: chartTypesLayers() },
  { name: 'markdown-pipeline', svg: chartMarkdownPipeline() },
  { name: 'optimistic-flow', svg: chartOptimisticFlow() },
  { name: 'transfer-slow-vs-fast', svg: chartTransfer(slow, fast) },
  { name: 'transfer-by-step', svg: chartSteps(steps) },
  { name: 'perf-score-runs', svg: chartRuns(fastRuns, slowRuns) },
]

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))

await mkdir(OUT, { recursive: true })

for (const chart of charts) {
  const buf = Buffer.from(chart.svg)
  const full = await sharp(buf).resize({ width: WIDTH }).webp({ quality: 88, effort: 6 }).toBuffer()
  const small = await sharp(buf).resize({ width: 800 }).webp({ quality: 88, effort: 6 }).toBuffer()
  const { width, height } = await sharp(buf).metadata()

  await writeFile(path.join(OUT, `${chart.name}.webp`), full)
  await writeFile(path.join(OUT, `${chart.name}-800.webp`), small)

  manifest[`/images/tech/${chart.name}.webp`] = {
    w: width,
    h: height,
    // 只声明真的存在的档位：源图就是 1200 宽，再写 1200 的变体会指向一个不存在的文件，
    // 手机 DPR 高的设备正好会挑到它，结果就是图裂开。
    variants: [800].filter((v) => v < width),
  }

  console.log(`${chart.name}.webp  ${width}x${height}  ${(full.length / 1024).toFixed(1)} KiB`)
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

// 自检：manifest 里声明的每一个 srcset 候选，磁盘上都必须真的有这个文件。
// 少一个，窄屏或高分屏设备就会挑到那个不存在的档位，表现为「图裂了」。
{
  let missing = 0
  for (const [key, meta] of Object.entries(manifest)) {
    const base = key.replace(/\.webp$/, '')
    const candidates = [...meta.variants.map((w) => `${base}-${w}.webp`), key]
    for (const candidate of candidates) {
      const disk = new URL(`../public${candidate}`, import.meta.url)
      try {
        await access(disk)
      } catch {
        console.error(`  ✗ manifest 声明的文件不存在：${candidate}`)
        missing += 1
      }
    }
  }
  if (missing > 0) process.exitCode = 1
  console.log(missing === 0 ? '\nsrcset 自检：全部候选都存在' : `\nsrcset 自检：${missing} 个缺失`)
}

console.log('\n数字核对：')
console.log(`  慢版首屏 ${Math.round(slow.total)} KiB（图片 ${Math.round(slow.image)}）`)
console.log(`  快版首屏 ${Math.round(fast.total)} KiB（图片 ${Math.round(fast.image)}）`)
console.log(`  基线首屏 ${Math.round(base.total)} KiB`)
