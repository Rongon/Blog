/**
 * 自写的 Vite 插件：在构建时把 .md 编译成 JS 模块。
 *
 * 为什么自己写而不是用 unplugin-vue-markdown 之类现成的？
 *   现成插件做的是「把 .md 变成一个 Vue 组件」，通常还配套一套文件路由，
 *   对一个只要「HTML + 元数据」的博客来说概念太多。
 *   自己写只需要三个概念：插件是对象、transform 是钩子、返回值换掉内容。
 *
 * 一个 .md 文件经过这里之后，会变成这样的 JS 模块：
 *
 *   export const meta = { title, summary, category, tags, date, readingMinutes, cover }
 *   export const toc  = [{ id, text, level }, ...]
 *   export const html = '<h2 id="...">...</h2>...'
 *
 * 关键点：markdown-it 和 Shiki 都只在 Node 里跑。
 * 浏览器拿到的是已经编译好的 HTML 字符串，一个字的高亮库都不会下载。
 */

import MarkdownIt from 'markdown-it'
import { createHighlighter, type Highlighter } from 'shiki'
import { readFileSync, existsSync } from 'node:fs'
import type { Plugin } from 'vite'
import type { PostFrontmatter, TocItem } from '../src/types/content'

/** 高亮用的语言。没列在这里的会退化成纯文本，不会报错。 */
const LANGS = [
  'text', 'ts', 'js', 'vue', 'html', 'css', 'scss', 'json',
  'bash', 'shell', 'md', 'yaml', 'nginx', 'diff',
]

let highlighterPromise: Promise<Highlighter> | null = null

/**
 * 最终生效的 base（本地是 `/`，GitHub Pages 子路径部署时是 `/Blog/`）。
 * 由下面的 configResolved 钩子写入，用来给正文里的图片补上前缀。
 */
let base = '/'

/** 给站点内的绝对路径补上 base。/images/a.webp → /Blog/images/a.webp */
function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path
  return `${base.replace(/\/+$/, '')}${path}`
}

interface ImageEntry {
  w: number
  h: number
  variants: number[]
}

/**
 * 图片清单：哪张图有哪些宽度档位。由 scripts/optimize-images.mjs 生成。
 *
 * 读不到就退化成空对象——第一次 clone 下来还没跑过图片脚本时不该让构建挂掉，
 * 大不了不输出 srcset。
 */
function loadImageManifest(): Record<string, ImageEntry> {
  try {
    const url = new URL('../src/data/image-manifest.json', import.meta.url)
    return JSON.parse(readFileSync(url, 'utf8')) as Record<string, ImageEntry>
  } catch {
    return {}
  }
}

const IMAGE_MANIFEST = loadImageManifest()

/** 正文图片都在 .article-body 里，而那个容器的最大宽度是 720px */
const ARTICLE_IMAGE_SIZES = '(max-width: 780px) calc(100vw - 48px), 720px'

/**
 * Shiki 的初始化是异步的，而插件工厂是同步调用的。
 * 所以这里做一层惰性缓存：第一次 transform 时才真正创建，
 * 之后所有文件共用同一个实例（创建一次要几百毫秒，别每个文件都建）。
 */
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      // 用双主题：同一段代码同时带上浅色和深色两套颜色，
      // 具体显示哪一套交给 CSS 决定（见下面的 html 输出与 tokens.scss）。
      themes: ['github-light', 'github-dark'],
      langs: LANGS,
    })
  }
  return highlighterPromise
}

/**
 * 极简 frontmatter 解析：只认 `---` 之间的 `key: value`。
 * 支持三种值：数组（`[a, b]`）、整数、字符串。
 * 够用了——真需要复杂结构的时候再换 gray-matter 也不迟。
 */
function parseFrontmatter(raw: string): { data: Partial<PostFrontmatter>; body: string } {
  const matched = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!matched) return { data: {}, body: raw }

  const data: Record<string, unknown> = {}
  for (const line of matched[1].split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()

    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (/^-?\d+$/.test(value)) {
      data[key] = Number(value)
    } else {
      data[key] = value.replace(/^["']|["']$/g, '')
    }
  }
  return { data: data as Partial<PostFrontmatter>, body: raw.slice(matched[0].length) }
}

/** 把标题文字变成一个可用的锚点 id；重复时自动加 -2、-3 */
function makeSlug(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      // \p{L} 是「任意语言的字母」，所以中文标题也能保留下来
      .replace(/[^\p{L}\p{N}-]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'

  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

export default function markdownPlugin(options: { naive?: boolean } = {}): Plugin {
  /**
   * 慢版（优化前）构建时为 true。
   *
   * 只影响正文图片：不生成 srcset / sizes / width / height，也不加懒加载，
   * 图片直接指回 raw-images 里的原图（构建慢版时会拷到 dist-naive/images）。
   * 其余的解析、高亮、目录逻辑两边完全一样 —— 慢版不是另一个站点。
   */
  const naive = options.naive === true

  return {
    name: 'blog:markdown',

    // 必须抢在 Vite 核心插件之前处理，
    // 否则 .md 会被当成 JS 去解析然后报错。
    enforce: 'pre',

    /**
     * 拿到最终的 base。
     * GitHub Pages 是子路径部署（`/Blog/`），正文里写死的 `/images/x.jpg`
     * 到线上会少一层前缀变成 404，所以这里得提前知道 base，在生成 HTML 时就补上。
     */
    configResolved(config) {
      base = config.base
    },

    async transform(src, id) {
      // id 上可能挂着查询串（比如 ?raw），只取文件路径部分
      const [file] = id.split('?')
      if (!file.endsWith('.md')) return

      const { data, body } = parseFrontmatter(src)
      const highlighter = await getHighlighter()

      const toc: TocItem[] = []
      const usedIds = new Set<string>()

      const md = new MarkdownIt({
        html: false, // 不允许正文里直接写 HTML，从源头上缩小 XSS 面
        linkify: false,
        typographer: false,
        highlight(code, lang) {
          const target = highlighter.getLoadedLanguages().includes(lang) ? lang : 'text'
          return highlighter.codeToHtml(code, {
            lang: target,
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: 'light',
          })
        },
      })

      // 给标题加 id，顺便把 toc 收集出来。
      // 覆盖 renderer.rules 比事后用正则去改 HTML 可靠得多。
      md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
        const token = tokens[idx]
        const level = Number(token.tag.slice(1))
        if (level === 2 || level === 3) {
          const inline = tokens[idx + 1]
          const text =
            inline?.type === 'inline'
              ? (inline.children ?? [])
                  .filter((t) => t.type === 'text' || t.type === 'code_inline')
                  .map((t) => t.content)
                  .join('') || inline.content
              : ''
          const anchor = makeSlug(text, usedIds)
          token.attrSet('id', anchor)
          toc.push({ id: anchor, text, level })
        }
        return self.renderToken(tokens, idx, options)
      }

      // 正文里的图片，做两件事：
      //   1. 补 base 前缀（GitHub Pages 是子路径部署，写死的 /images/x.webp 到线上会 404）
      //   2. 如果这张图在清单里，补上 srcset + sizes（也就是「响应式图片」这项优化）
      const renderImage =
        md.renderer.rules.image ??
        ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

      md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const srcIndex = token.attrIndex('src')

        // 慢版：图片就是一张原图，别的什么都不给（这是优化项 2/3/4 之前的样子）
        if (naive) {
          if (srcIndex >= 0 && token.attrs) {
            const raw = token.attrs[srcIndex][1]
            // 有原图的（照片、封面）换回 .jpg —— 慢版跑的就是这些 3000px 的大图。
            // 没有原图的（正文里那些由 scripts/build-charts.mjs 生成的图表）保持 .webp：
            // 它们是内容本身，不是被优化的素材，没有「优化前」的那一份。
            const original = raw.replace(/\.webp$/i, '.jpg')
            const hasOriginal = existsSync(new URL(`../raw-images${original}`, import.meta.url))
            token.attrs[srcIndex][1] = withBase(hasOriginal ? original : raw)
          }
          return renderImage(tokens, idx, options, env, self)
        }

        if (srcIndex >= 0 && token.attrs) {
          const raw = token.attrs[srcIndex][1]
          const entry = IMAGE_MANIFEST[raw]

          if (entry) {
            const candidates = entry.variants.map(
              (w) => `${withBase(raw.replace(/\.webp$/i, `-${w}.webp`))} ${w}w`,
            )
            // 全尺寸那张也算一个候选，供超宽屏或高 DPR 使用
            candidates.push(`${withBase(raw)} ${entry.w}w`)
            token.attrSet('srcset', candidates.join(', '))
            token.attrSet('sizes', ARTICLE_IMAGE_SIZES)
            // 原始宽高：让浏览器在图到之前就把位置留出来，避免加载完把正文往下推（CLS）
            token.attrSet('width', String(entry.w))
            token.attrSet('height', String(entry.h))
          }

          token.attrs[srcIndex][1] = withBase(raw)
        }

        // 正文里的图一律懒加载 + 异步解码。
        // 浏览器不会推迟「已经在视口里」的图，所以文章第一张图不会被拖慢。
        token.attrSet('loading', 'lazy')
        token.attrSet('decoding', 'async')

        return renderImage(tokens, idx, options, env, self)
      }

      const html = md.render(body)

      // 交给 Vite 的是一段 JS 源码。JSON.stringify 保证字符串安全转义。
      const code = [
        `export const meta = ${JSON.stringify(data)}`,
        `export const toc = ${JSON.stringify(toc)}`,
        `export const html = ${JSON.stringify(html)}`,
      ].join('\n')

      return { code, map: null }
    },
  }
}
