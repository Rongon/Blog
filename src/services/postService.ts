/**
 * 文章数据服务。
 *
 * 【为什么要有这一层】
 * 页面上「筛选、分页、搜索」的逻辑不该关心数据从哪来。今天数据在本地数组里，
 * 模块 7 / 二期接上 CloudBase 之后就从远端来——只要这个函数的签名不变，页面一行都不用改。
 *
 * 【为什么是异步的】
 * 因为真实的取数就是异步的。接口从第一天就按异步形状写，
 * 顺带把「取消信号」这条线也一次接好：现在本地数据不会真的竞态，
 * 但等数据真的走网络，这段代码已经是安全的了。
 */

import { posts, type PostMeta } from '@/data/posts'

export const PAGE_SIZE = 4

export interface PostQuery {
  page: number
  pageSize: number
  category?: string
  tag?: string
  keyword?: string
}

export interface PostListResult {
  items: PostMeta[]
  total: number
  /** 服务端（这里指数据层）实际返回的页码，可能比请求的更小 */
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 取文章列表。
 *
 * @param query  筛选条件
 * @param signal 取消信号。调用方在发起新请求前 abort 上一个，
 *               这样「先发的请求后回来」就不会覆盖新结果。
 */
export async function fetchPosts(query: PostQuery, signal?: AbortSignal): Promise<PostListResult> {
  // 进函数先看一眼：还没开始干就已经被取消了，就别干了
  signal?.throwIfAborted()

  // 让出一次微任务。今天没有网络往返，但要保持异步形状——
  // 将来换成 CloudBase 的 await，调用方的逻辑一点不用动。
  await Promise.resolve()
  signal?.throwIfAborted()

  const kw = query.keyword?.trim().toLowerCase()

  const filtered = posts
    .filter((p) => {
      if (query.category && p.category !== query.category) return false
      if (query.tag && !p.tags.includes(query.tag)) return false
      if (kw) {
        const hit =
          p.title.toLowerCase().includes(kw) ||
          p.summary.toLowerCase().includes(kw) ||
          p.tags.some((t) => t.toLowerCase().includes(kw))
        if (!hit) return false
      }
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  // 越界的页码在这里被夹回来：比如 ?page=99 只有 2 页，实际返回第 2 页
  const page = Math.min(Math.max(1, query.page), totalPages)
  const start = (page - 1) * query.pageSize

  return {
    items: filtered.slice(start, start + query.pageSize),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  }
}
