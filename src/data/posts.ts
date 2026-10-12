/**
 * 文章数据层。
 *
 * 【数据从哪来】不再是手写的数组，而是 content/posts 下所有的 .md 文件。
 *   每个 .md 都被 plugins/markdown.ts 在**构建时**编译成 JS 模块，
 *   里面有 meta（frontmatter）、html（编译好的正文）、toc（标题树）。
 *
 * 【eager: true 是刻意的】它让所有文章的 HTML 一起打进主包。
 *   这就是「优化前」的行为：打开首页也要把六篇文章的正文全部下载下来。
 *   阶段 3 会把它换成按需加载——每个 .md 单独成一个 chunk，进详情页才下载。
 *   到那时这个文件只需要改这一行，页面代码不用动。
 *
 * 关于 import.meta.glob 的三个要点：
 *   · 它是 Vite 特有的编译期语法，不是浏览器标准，路径必须是**字面量字符串**
 *   · 不写 eager 时返回的是 `() => import(...)` 的映射，打包器据此分包
 *   · 它是**构建时**就确定了文件列表，跟运行时用 fetch 去列目录完全不同
 */

import type { MarkdownModule, PostMeta, TocItem } from '@/types/content'

export type { PostMeta, TocItem } from '@/types/content'

const modules = import.meta.glob<MarkdownModule>('../../content/posts/*.md', { eager: true })

/** `../../content/posts/hello-world.md` → `hello-world` */
function slugFromPath(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/, '')
}

/** 全部文章，按日期倒序 */
export const posts: PostMeta[] = Object.entries(modules)
  .map(([path, mod]) => ({ ...mod.meta, slug: slugFromPath(path) }))
  .sort((a, b) => b.date.localeCompare(a.date))

/** 首页「最近写的」用 */
export function getRecentPosts(limit = 3): PostMeta[] {
  return posts.slice(0, limit)
}

/** 详情页用：拿到 meta + 编译好的 html + 目录 */
export interface PostDetail {
  meta: PostMeta
  html: string
  toc: TocItem[]
}

export function getPostBySlug(slug: string): PostDetail | undefined {
  const entry = Object.entries(modules).find(([path]) => slugFromPath(path) === slug)
  if (!entry) return undefined

  const [path, mod] = entry
  return {
    meta: { ...mod.meta, slug: slugFromPath(path) },
    html: mod.html,
    toc: mod.toc,
  }
}

/** 详情页底部的上/下一篇。newer 是更新的那篇，older 是更早的那篇。 */
export function getAdjacentPosts(slug: string): { newer?: PostMeta; older?: PostMeta } {
  const i = posts.findIndex((p) => p.slug === slug)
  if (i < 0) return {}
  return {
    newer: i > 0 ? posts[i - 1] : undefined,
    older: i < posts.length - 1 ? posts[i + 1] : undefined,
  }
}

export function getPostsByCategory(category: string): PostMeta[] {
  return posts.filter((p) => p.category === category)
}

/** 全部标签，按出现次数倒序 */
export function getAllTags(): string[] {
  const count = new Map<string, number>()
  for (const p of posts) {
    for (const t of p.tags) count.set(t, (count.get(t) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

export function getAllCategories(): string[] {
  return [...new Set(posts.map((p) => p.category))]
}
