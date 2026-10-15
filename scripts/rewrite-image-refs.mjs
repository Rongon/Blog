/**
 * 把代码与内容里所有 `/images/....jpg` 的引用改成 `.webp`。
 *
 * 这是一次性的迁移脚本，跑完就删也行。之所以单独写而不是手改：
 * 图片引用散在 6 篇 Markdown 的 frontmatter 与正文、两个数据文件、一个视图里，
 * 手改容易漏，而漏掉的那一张恰恰会在线上 404。
 *
 * 用法：node scripts/rewrite-image-refs.mjs [--dry]
 */

import { readFile, writeFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DRY = process.argv.includes('--dry')

const FIXED = [
  'src/data/posts.ts',
  'src/data/projects.ts',
  'src/views/HomeView.vue',
]

async function collect() {
  const files = [...FIXED]
  const postDir = join(ROOT, 'content', 'posts')
  for (const f of await readdir(postDir)) {
    if (f.endsWith('.md')) files.push(`content/posts/${f}`)
  }
  return files
}

// 只匹配以 /images/ 开头、以 .jpg/.jpeg 结尾的路径
const RE = /(\/images\/[A-Za-z0-9_\-./]+)\.jpe?g/g

const files = await collect()
let totalHits = 0

for (const rel of files) {
  const full = join(ROOT, rel)
  const before = await readFile(full, 'utf8')
  const hits = (before.match(RE) ?? []).length
  if (!hits) continue

  const after = before.replace(RE, '$1.webp')
  totalHits += hits
  console.log(`${DRY ? '[dry] ' : ''}${rel.padEnd(38)} ${hits} 处`)

  if (!DRY) await writeFile(full, after, 'utf8')
}

console.log('-'.repeat(52))
console.log(`共 ${files.length} 个文件被扫描，替换 ${totalHits} 处${DRY ? '（未写入）' : ''}`)
