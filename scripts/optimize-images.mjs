/**
 * 图片处理：把 public/images 下的 JPG 转成 WebP，并生成多档宽度 + 一份清单。
 *
 * 产出三样东西：
 *   1. `<name>.webp`          —— 全尺寸 WebP（就是原来那张图的 WebP 版）
 *   2. `<name>-400.webp` 等   —— 多档宽度，给 srcset 用
 *   3. `src/data/image-manifest.json` —— 每张图的原始宽高 + 有哪些档位
 *
 * 为什么清单要生成到 src/ 而不是 public/：
 *   它是构建期数据（给组件和 Markdown 插件读），不是要下载的资源。
 *   放在 src/ 下会被打包器当成模块处理，类型和路径都有保障；
 *   放 public/ 就得运行时再发一个请求去取，白白多一次往返。
 *
 * 为什么是「跑一次、把产物提交进仓库」而不是构建时动态转换：
 *   图片是内容不是代码；构建时转意味着 CI 每次都要跑 sharp、装原生依赖；
 *   产物进仓库后 diff 里能直接看到「哪张图从多大变成多大」。
 *
 * 用法：node scripts/optimize-images.mjs
 */

import { readdir, stat, writeFile } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IMAGES_DIR = join(ROOT, 'public', 'images')
const MANIFEST = join(ROOT, 'src', 'data', 'image-manifest.json')
const QUALITY = 80

/** srcset 用的档位。比原图还大的档位会被跳过——放大图片只会更大更糊。 */
const WIDTHS = [400, 800, 1200, 1600]

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    // 只处理原图：带 -400/-800 这种后缀的是上一次跑出来的产物
    else if (/\.jpe?g$/i.test(entry.name)) out.push(full)
  }
  return out
}

const files = await walk(IMAGES_DIR)
if (!files.length) {
  console.error('没有找到任何 jpg，检查 public/images 是否存在')
  process.exit(1)
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`
const manifest = {}
let totalOriginal = 0
const rows = []

for (const src of files) {
  // 相对 public 的路径，且以 / 开头 —— 这就是页面里引用它时写的那个路径
  const publicPath = '/' + relative(join(ROOT, 'public'), src).replace(/\\/g, '/')
  const webpPath = publicPath.replace(/\.(jpe?g)$/i, '.webp')
  const dest = join(ROOT, 'public', webpPath.replace(/^\//, ''))

  const meta = await sharp(src).metadata()
  const originalWidth = meta.width ?? 0
  const originalHeight = meta.height ?? 0

  // 1. 全尺寸 WebP
  await sharp(src).webp({ quality: QUALITY }).toFile(dest)

  // 2. 多档宽度
  const variants = []
  for (const w of WIDTHS) {
    if (w >= originalWidth) continue
    const variant = dest.replace(/\.webp$/, `-${w}.webp`)
    await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(variant)
    variants.push(w)
  }

  // 3. 写进清单
  manifest[webpPath] = { w: originalWidth, h: originalHeight, variants }

  const before = (await stat(src)).size
  const after = (await stat(dest)).size
  totalOriginal += before
  rows.push({ name: relative(IMAGES_DIR, src).replace(/\\/g, '/'), before, after, variants: variants.join('/') })
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

rows.sort((a, b) => b.before - a.before)
console.log('file'.padEnd(30), 'jpg'.padStart(9), 'webp'.padStart(9), '档位'.padStart(18))
console.log('-'.repeat(70))
for (const r of rows) {
  console.log(r.name.padEnd(30), kb(r.before).padStart(9), kb(r.after).padStart(9), r.variants.padStart(18))
}
const totalWebp = rows.reduce((s, r) => s + r.after, 0)
console.log('-'.repeat(70))
console.log(
  `${rows.length} 张`.padEnd(30),
  kb(totalOriginal).padStart(9),
  kb(totalWebp).padStart(9),
  `省 ${Math.round((1 - totalWebp / totalOriginal) * 100)}%`.padStart(18),
)

// 加上各档变体的体积，看总共产出了多少
const allFiles = await readdir(IMAGES_DIR, { recursive: true })
const variantBytes = allFiles
  .filter((f) => /-\d+\.webp$/i.test(f))
  .length
console.log(`\n清单已写入 src/data/image-manifest.json（${Object.keys(manifest).length} 条）`)
console.log(`额外生成 ${variantBytes} 个宽度变体文件`)
