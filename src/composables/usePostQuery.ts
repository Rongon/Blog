/**
 * 把「文章的筛选状态」全部放进 URL。
 *
 * 核心约定：URL 是唯一真相源。
 * 页面不自己存一分筛选状态，所有条件都从 route.query 派生；
 * 想改筛选条件，只能走 updateQuery——它是全站唯一的出口。
 *
 * 这样带来的三个好处（也就是面试会被问的三个点）：
 *   1. 刷新页面视图还在——因为状态本来就在 URL 里，不在内存里。
 *   2. 浏览器前进 / 后退天然可用——因为每次改筛选都是一次真实导航。
 *   3. 别人可以把「筛选到某个结果」的链接直接发给你，打开就是同一个视图。
 *
 * URL 形状：/articles?page=2&category=技术&tag=Vite&q=vite
 * 默认值不进 URL（page=1 会被删掉），保证干净链接只有一个。
 */

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllCategories, getAllTags } from '@/data/posts'
import { fetchPosts, PAGE_SIZE, type PostListResult, type PostQuery } from '@/services/postService'

const QUERY_KEYS = ['page', 'category', 'tag', 'q'] as const
type QueryKey = (typeof QUERY_KEYS)[number]
type QueryPatch = Partial<Record<QueryKey, string | number | undefined>>
type RawValue = string | null | (string | null)[] | undefined

/** route.query 的值可能是数组（?tag=a&tag=b），这里只取第一个 */
function firstString(v: RawValue): string | undefined {
  if (Array.isArray(v)) return v[0] ?? undefined
  return v ?? undefined
}

function isAborted(e: unknown): boolean {
  // 原生 fetch / 我们的数据层抛 DOMException(AbortError)；
  // 换成 axios 时这里会变成 CanceledError，判断方式一样。
  return e instanceof DOMException && e.name === 'AbortError'
}

export function usePostQuery() {
  const route = useRoute()
  const router = useRouter()

  const categories = getAllCategories()
  const tags = getAllTags()

  const rawQuery = computed(() => route.query as Record<string, RawValue>)

  /* ---------------------------------------------------------------
   * 一、把 URL 归一化成「合法的筛选条件」
   *    URL 是用户能随手改的，?page=abc、?category=不存在 都可能出现，
   *    所以不能直接信任它，得先清洗一遍再用。
   * ------------------------------------------------------------- */
  const rawPage = computed(() => {
    const n = Number(firstString(rawQuery.value.page))
    return Number.isInteger(n) && n >= 1 ? n : 1
  })
  const rawCategory = computed(() => firstString(rawQuery.value.category))
  const rawTag = computed(() => firstString(rawQuery.value.tag))
  const rawKeyword = computed(() => (firstString(rawQuery.value.q) ?? '').trim())

  const page = computed(() => rawPage.value)
  const category = computed(() =>
    rawCategory.value && categories.includes(rawCategory.value) ? rawCategory.value : undefined,
  )
  const tag = computed(() => (rawTag.value && tags.includes(rawTag.value) ? rawTag.value : undefined))
  const keyword = computed(() => (rawKeyword.value ? rawKeyword.value : undefined))

  /** 归一化之后的筛选条件，页面上只认这一个 */
  const filter = computed<PostQuery>(() => ({
    page: page.value,
    pageSize: PAGE_SIZE,
    category: category.value,
    tag: tag.value,
    keyword: keyword.value,
  }))

  /* ---------------------------------------------------------------
   * 二、唯一出口：updateQuery
   *   1. 先拷一份现有的 query —— 因为 router.push({ query }) 是「替换」
   *      而不是「合并」，不拷就会把别的参数全弄丢。
   *   2. 空值和默认值不进 URL。
   *   3. 默认改动筛选时把 page 重置为 1。
   * ------------------------------------------------------------- */
  function updateQuery(
    patch: QueryPatch,
    opts: { resetPage?: boolean; replace?: boolean } = {},
  ) {
    const resetPage = opts.resetPage ?? true
    const next: Record<string, string> = {}

    for (const [k, v] of Object.entries(route.query)) {
      const s = firstString(v as RawValue)
      if (s !== undefined) next[k] = s
    }

    for (const key of QUERY_KEYS) {
      if (!(key in patch)) continue
      const v = patch[key]
      if (v === undefined || v === null || v === '' || (key === 'page' && Number(v) === 1)) {
        delete next[key]
      } else {
        next[key] = String(v)
      }
    }

    if (resetPage && !('page' in patch)) delete next.page

    const target = { path: route.path, query: next }
    // 会留下历史记录用 push（翻页、切分类，用户「后退」应该能退回去）；
    // 边打字边搜用 replace（不该给每敲一个字母都塞一条历史记录）。
    return opts.replace ? router.replace(target) : router.push(target)
  }

  /* ---------------------------------------------------------------
   * 三、把非法的 URL 悄悄纠正回合法值
   *    用 replace，不留历史记录，用户按后退不会陷进死循环。
   * ------------------------------------------------------------- */
  function corrections(): QueryPatch | null {
    const fix: QueryPatch = {}
    if (rawCategory.value !== category.value) fix.category = category.value
    if (rawTag.value !== tag.value) fix.tag = tag.value
    const raw = firstString(rawQuery.value.page)
    if (raw !== undefined && raw !== String(page.value)) fix.page = page.value
    return Object.keys(fix).length ? fix : null
  }

  /* ---------------------------------------------------------------
   * 四、取数：可取消 + 序号兜底
   *    abort 是真取消（省掉没意义的活），序号是最后一道保险
   *    （已经回来的响应也不能覆盖更新的结果）。
   * ------------------------------------------------------------- */
  const loading = ref(false)
  const result = ref<PostListResult>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  })

  let controller: AbortController | null = null
  let seq = 0

  async function load() {
    controller?.abort()
    controller = new AbortController()
    const my = ++seq

    loading.value = true
    try {
      const r = await fetchPosts(filter.value, controller.signal)
      if (my !== seq) return // 有更新的请求在跑，这份结果已经过期了

      result.value = r

      // 数据层把越界页码夹回来了（?page=99 只有 2 页 → 实际第 2 页），
      // 这时候 URL 是错的，纠正它。注意：用 replace，不留历史。
      if (r.page !== filter.value.page) {
        updateQuery({ page: r.page === 1 ? undefined : r.page }, { replace: true, resetPage: false })
        return
      }

      const fix = corrections()
      if (fix) updateQuery(fix, { replace: true, resetPage: false })
    } catch (e) {
      if (!isAborted(e)) throw e
    } finally {
      if (my === seq) loading.value = false
    }
  }

  // 注意这里 watch 的是 filter（从 route.query 派生），不是 onMounted。
  // 同一个路由上换 query 会复用组件实例、不会重新执行 setup，
  // 只在 onMounted 里取数的话，翻到第 2 页就再也不会重新加载了。
  watch(filter, load, { immediate: true })

  return {
    categories,
    tags,
    page,
    category,
    tag,
    keyword,
    filter,
    loading,
    result,
    updateQuery,
  }
}
