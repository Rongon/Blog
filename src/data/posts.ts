/**
 * 文章元数据。
 *
 * 【当前实现】直接写死的数组——模块 2 只需要首页的「最近写的」，先把布局做出来。
 * 【模块 4 会换掉它】那时文章的正文和元数据都来自 content/posts/*.md，
 *   由自写的 Vite 插件在构建时编译。届时只替换本文件内部的实现，
 *   对外导出的 `getRecentPosts` / `getPostBySlug` 签名保持不变，页面代码不用动。
 *
 * 注意：这一份是「优化前」的写法——封面用的是原图大 JPG，
 * 没有 WebP、没有 srcset、没有懒加载。这些都留给阶段 3。
 */

export interface PostMeta {
  slug: string
  title: string
  summary: string
  category: string
  tags: string[]
  /** YYYY-MM-DD */
  date: string
  readingMinutes: number
  /** public 下的绝对路径 */
  cover: string
}

export const posts: PostMeta[] = [
  {
    slug: 'first-screen-3s-to-0s9s',
    title: '首屏从 3.2 秒到 0.9 秒：我做了什么，以及哪一项其实没用',
    summary:
      '把十来项优化逐项加上去，每次都重新跑一遍 Lighthouse。有几项基本没有收益，我也一起记下来了。',
    category: '技术',
    tags: ['性能优化', 'Vite'],
    date: '2026-02-11',
    readingMinutes: 8,
    cover: '/images/covers/mountains.jpg',
  },
  {
    slug: 'optimistic-comment-update',
    title: '评论区为什么要做成「乐观更新」，失败了又怎么收场',
    summary:
      '点发表，评论立刻上屏，请求在后台跑。真正难的不是让它显示，而是请求失败时怎么干净地退回去。',
    category: '技术',
    tags: ['工程实践', 'Vue'],
    date: '2026-01-27',
    readingMinutes: 6,
    cover: '/images/covers/forest-fog.jpg',
  },
  {
    slug: 'vite-plugin-markdown',
    title: '一个 Vite 插件，是怎么把 Markdown 变成页面的',
    summary:
      '不装现成的插件，自己写二十行：从 transform 钩子讲起，说清「构建时」和「运行时」到底差在哪。',
    category: '技术',
    tags: ['Vite', 'Markdown'],
    date: '2026-01-18',
    readingMinutes: 7,
    cover: '/images/covers/forest-sun.jpg',
  },
  {
    slug: 'coastline',
    title: '沿着海岸线走了一趟：照片和一点记录',
    summary: '出片不多，但有几张自己挺喜欢。顺带说说这些大图是怎么压到不拖慢页面的。',
    category: '旅行',
    tags: ['摄影'],
    date: '2026-01-05',
    readingMinutes: 4,
    cover: '/images/covers/lake.jpg',
  },
  {
    slug: 'dark-mode-is-not-inverting',
    title: '深色模式不只是把颜色反过来',
    summary:
      '直接翻转明度会得到一片发灰发脏的界面。这里记我试过的三版方案，以及最后为什么选了深灰蓝。',
    category: '技术',
    tags: ['设计', 'CSS'],
    date: '2025-12-22',
    readingMinutes: 5,
    cover: '/images/covers/night-sky.jpg',
  },
  {
    slug: 'dongjing-menghualu',
    title: '读《东京梦华录》：一个宋朝人的城市生活笔记',
    summary: '它写的是汴京的吃食、夜市和节令。读的时候总在想，八百年前的人也在意这些小事。',
    category: '读书',
    tags: ['历史'],
    date: '2025-12-09',
    readingMinutes: 9,
    cover: '/images/covers/waterfall.jpg',
  },
]

/** 首页「最近写的」用：按日期倒序取前 n 篇 */
export function getRecentPosts(limit = 3): PostMeta[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

/** 按分类取，模块 3 会用到 */
export function getPostsByCategory(category: string): PostMeta[] {
  return posts.filter((p) => p.category === category)
}

/** 全部标签（去重后按出现次数倒序），模块 3 会用到 */
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
