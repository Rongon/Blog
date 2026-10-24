/**
 * 把 raw-images 里的原图拷进慢版产物。
 *
 * 【为什么需要这一步】
 * 慢版（优化前）用的是未经处理的原始 JPG，而原图已经不在 public/ 下了 ——
 * 它们在 raw-images/，不参与快版构建（否则 21 张原图 35.7 MB 会跟着主站一起发布）。
 *
 * 慢版的路径规则：raw-images/photos/coast-10.jpg → dist-naive/images/photos/coast-10.jpg
 * 页面里的地址是 `/images/photos/coast-10.jpg`，加上 naive 的 base 就是
 * `/Blog/naive/images/photos/coast-10.jpg` —— 正好对上。
 *
 * 用法：node scripts/copy-naive-images.mjs [distDir]
 * 默认 distDir = dist-naive
 */

import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const FROM = join(ROOT, 'raw-images')
const distDir = process.argv[2] ?? 'dist-naive'
const TO = join(ROOT, distDir, 'images')

async function copyDir(from, to) {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dest = join(to, entry.name)
    if (entry.isDirectory()) {
      await copyDir(src, dest)
    } else if (/\.jpe?g$/i.test(entry.name)) {
      await cp(src, dest)
      bytes += (await stat(src)).size
      files += 1
    }
  }
}

let files = 0
let bytes = 0
await copyDir(FROM, TO)

if (files === 0) {
  console.error(`✗ ${FROM} 里没有 JPG —— 慢版的图片会全部 404`)
  process.exit(1)
}

console.log(`慢版原图：${files} 张，${(bytes / 1024 / 1024).toFixed(1)} MB → ${TO}`)
