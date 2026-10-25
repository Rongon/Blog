/**
 * 项目数据。
 *
 * 只放**这一个**项目：站点自己。工作里的项目不放在这里 ——
 * 那些写进简历，面试官问到再讲；站上只留能被点开、能被验证的东西。
 *
 * 文案口径提醒：正文里的数字要和 `perf/` 里的报告一致；不一致时以实测为准，别倒过来改数字。
 */

export interface ProjectSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface ProjectLink {
  label: string
  href: string
}

export interface ProjectMeta {
  slug: string
  name: string
  /** 一句话定位，卡片上用 */
  tagline: string
  /** 一两句说明，列表页与详情页头部用 */
  summary: string
  role: string
  period: string
  stack: string[]
  /** 卡片缩略图，public 下的绝对路径；空字符串表示暂时不放图 */
  thumb: string
  /** 站内详情页路径；空字符串表示暂无详情页，卡片不可点 */
  to: string
  /** 卡片上的两条重点 */
  highlights: string[]
  /** 详情页正文 */
  sections: ProjectSection[]
  links?: ProjectLink[]
}

export const projects: ProjectMeta[] = [
  {
    slug: 'blog',
    name: 'Blog · 技术博客与性能实验',
    tagline: '本站。同一份内容，优化前后各部署一版，数字公开展示对比。',
    summary:
      '一个前端的技术博客：Markdown 在构建时编译成页面，评论区用乐观更新保证即时反馈，图片、缓存与分包策略都做过实测对照。',
    role: '独立开发',
    period: '2026.10 - 至今',
    stack: ['Vue 3', 'TypeScript', 'Vite', 'Pinia', 'Markdown-it', 'Shiki'],
    thumb: '/images/covers/forest-sun.webp',
    to: '/projects/blog',
    highlights: [
      '构建时把 Markdown 编译成 HTML，客户端不下载任何解析器',
      '站内提供「优化前 / 优化后」两个入口，可现场对照首屏指标',
    ],
    links: [{ label: '源码仓库', href: 'https://github.com/Rongon/Blog' }],
    sections: [
      {
        heading: '这个站想解决什么问题',
        paragraphs: [
          '它是一个真实在用的小产品，不是一份技能清单：有文章、有评论、有取舍记录，也把「怎么验证」这一步留在站内。',
          '写它的过程中攒下的东西比页面本身多——下面这些技术决定，每一条都是做的时候踩到问题才定下来的，不是先有方案再套上去的。',
        ],
      },
      {
        heading: '几个主要的技术决定',
        bullets: [
          '**文章走构建时渲染**：自己写了一个 Vite 插件，在打包阶段用 markdown-it + Shiki 把 .md 编译成 HTML，客户端一个解析库都不下载。代价是改文章要重新构建部署——对博客来说这个代价可以接受。',
          '**URL 是筛选状态的唯一数据源**：分页、分类、标签、关键词全部写进 query，页面只是读它。好处是刷新、前进后退、分享链接都能还原视图。',
          '**评论区用乐观更新**：点发表先上屏，请求失败再干净地回滚，配合客户端临时 id 与防重复提交保证状态一致。',
        ],
      },
      {
        heading: '性能优化这一块是怎么做的',
        paragraphs: [
          '用了最笨也最清楚的办法：功能写完先把「优化前」那版留在一个单独的构建模式里，之后一项一项地优化，每改一项就重新构建、重新跑一次 Lighthouse，把原始 JSON 存进仓库。',
        ],
        bullets: [
          '两个版本都真实部署，站内给两个入口，点一下就换过去',
          '每一项都记「预期收益 vs 实测收益」',
          '所有数字都来自 Lighthouse 的 JSON 报告，跑测命令写在 README 里，可以自己复现',
        ],
      },
      {
        heading: '已知的不足',
        bullets: [
          '托管层动不了：GitHub Pages 自带 CDN、HTTP/2 与压缩，这几项没有「开 / 不开」两个版本可比，所以文档里标的是「无基线」，不算成绩。',
          '全部数据来自桌面实验室（Lighthouse 桌面预设）。',
          '评论与登录依赖第三方云服务，离线环境下不可用。',
        ],
      },
    ],
  },
]

export function getProjectBySlug(slug: string): ProjectMeta | undefined {
  return projects.find((p) => p.slug === slug)
}

export function getFeaturedProjects(limit = 2): ProjectMeta[] {
  return projects.slice(0, limit)
}

/** 上一个 / 下一个项目，详情页底部用 */
export function getAdjacentProjects(slug: string): { prev?: ProjectMeta; next?: ProjectMeta } {
  const i = projects.findIndex((p) => p.slug === slug)
  if (i < 0) return {}
  return { prev: projects[i - 1], next: projects[i + 1] }
}
