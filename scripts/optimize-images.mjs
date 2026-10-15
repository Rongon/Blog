/**
 * 把 public/images 下的 JPG 转成 WebP。
 *
 * 为什么是一个"跑一次、把产物提交进仓库"的脚本，而不是构建时动态转换：
 *   · 图片是内容，不是代码。内容变了才需要重新转，跟构建频率对不上。
 *   · 构建时转意味着 CI 每次都要跑一遍 sharp（几十秒），而且要在 CI 上装原生依赖。
 *   · 产物进仓库后，diff 里能直接看到"这次换了哪些图、从多大变成多大"。
 *
 * 用法：node scripts/optimize-images.mjs
 * 产物：与每个 .jpg 同目录同名的 .webp（原图保留，后面 <picture> 要用它做兜底）
 */

import { readdir, stat } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IMAGES_DIR = join(ROOT, 'public', 'images')
const QUALITY = 80

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (/\.(jpe?g)$/i.test(entry.name)) out.push(full)
  }
  return out
}

const files = await walk(IMAGES_DIR)
if (!files.length) {
  console.error('没有找到任何 jpg，检查 public/images 是否存在')
  process.exit(1)
}

let totalBefore = 0
let totalAfter = 0
const rows = []

for (const src of files) {
  const dest = src.replace(/\.(jpe?g)$/i, '.webp')
  await sharp(src).webp({ quality: QUALITY }).toFile(dest)

  const before = (await stat(src)).size
  const after = (await stat(dest)).size
  totalBefore += before
  totalAfter += after
  rows.push({
    name: relative(IMAGES_DIR, src).replace(/\\/g, '/'),
    before,
    after,
    pct: Math.round((1 - after / before) * 100),
  })
}

rows.sort((a, b) => b.before - a.before)
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

console.log('file'.padEnd(34), 'jpg'.padStart(9), 'webp'.padStart(9), '省'.padStart(6))
console.log('-'.repeat(62))
for (const r of rows) {
  console.log(r.name.padEnd(34), kb(r.before).padStart(9), kb(r.after).padStart(9), `${r.pct}%`.padStart(6))
}
console.log('-'.repeat(62))
console.log(
  '合计'.padEnd(34),
  kb(totalBefore).padStart(9),
  kb(totalAfter).padStart(9),
  `${Math.round((1 - totalAfter / totalBefore) * 100)}%`.padStart(6),
)
