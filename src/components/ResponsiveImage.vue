<script setup lang="ts">
/**
 * 响应式图片。
 *
 * 【它解决什么】一张 3000px 宽的大图，在窄的容器里会被缩到几百 px 显示，
 * 但浏览器下载的仍然是那 3000px 的版本——白白多花十几倍流量。
 *
 * 【怎么解决】给 `<img>` 两个属性：
 *   · `srcset` —— 列出「这个文件名 + 这张图有多宽」，把选择权交给浏览器
 *   · `sizes`  —— 告诉浏览器「在什么屏幕宽度下，我会把它显示成多宽」
 * 浏览器拿这两个信息算出「我到底需要多宽的图」，再从 srcset 里挑最接近的一档。
 * 注意：这个「挑」发生在 CSS 布局之前，是预加载扫描器做的，
 * 所以 `sizes` 写得不准，浏览器就会挑错档位——它不会等你布局完再改主意。
 *
 * 【为什么不写 media query 自己判断】那是 JS 的活，会拖到 JS 执行完才发请求。
 * srcset/sizes 是纯声明式的，HTML 解析到就能开始下载。
 */

import { computed } from 'vue'
import manifest from '@/data/image-manifest.json'
import { asset } from '@/lib/asset'

const props = defineProps<{
  /** 全尺寸图的站点内路径，例如 /images/photos/coast-10.webp */
  src: string
  alt: string
  /** 这张图在各个断点下会占多宽。写错就等于没优化，甚至更糟 */
  sizes: string
  /**
   * 是否属于首屏。
   *
   * 默认 false = 懒加载：浏览器滚动到它附近才开始下载。
   * 首屏那张图必须传 true，否则会反过来拖慢 LCP——因为它要等布局算完才开始下载。
   * 传 true 时还会加 fetchpriority="high"，让它在并发队列里排前面。
   */
  eager?: boolean
}>()

interface ImageEntry {
  w: number
  h: number
  variants: number[]
}

const table = manifest as Record<string, ImageEntry>

/** `/a/b.webp` + 800 → `/a/b-800.webp` */
function atWidth(width: number): string {
  return props.src.replace(/\.webp$/i, `-${width}.webp`)
}

const srcset = computed(() => {
  const entry = table[props.src]
  // 清单里没有这张图就老老实实退化成普通图，不要凭空编出一个会 404 的 srcset
  if (!entry) return undefined

  const parts = entry.variants.map((w) => `${asset(atWidth(w))} ${w}w`)
  // 全尺寸那张也作为候选：屏幕特别宽或 DPR 很高时才会轮到它
  parts.push(`${asset(props.src)} ${entry.w}w`)
  return parts.join(', ')
})

const src = computed(() => asset(props.src))

/**
 * 原始宽高，用来输出 `width` / `height` 属性。
 *
 * 【为什么这两个属性这么重要】它们不是为了排版，而是给浏览器一个「这块地方占多大」的
 * 提前量：图还没下载完，浏览器就知道该预留多高的位置，于是不会等图到了再把下面的内容
 * 往下推。那个「推一下」就是 CLS（视觉偏移）的来源。
 *
 * 配合 CSS 里的 `height: auto`，浏览器会从这两个属性算出宽高比，图片又能等比缩放。
 * 所以这不是「写死尺寸」，是「提前告诉浏览器比例」。
 */
const width = computed(() => table[props.src]?.w)
const height = computed(() => table[props.src]?.h)
</script>

<template>
  <!--
    loading：
      · eager  → 立刻下载，并让它在并发队列里排前面（首屏图必须这样）
      · lazy   → 浏览器滚到它附近（Chrome 大约是提前 1250px）才开始下载
    注意 lazy 不等于「永远不下载在视口里的图」——浏览器不会推迟已经在视口内的图片，
    所以给卡片统一加 lazy 是安全的，不会打坏首屏。

    decoding="async"：解码放到另一个线程，不阻塞主线程渲染。
  -->
  <img
    :src="src"
    :srcset="srcset"
    :sizes="srcset ? sizes : undefined"
    :alt="alt"
    :width="width"
    :height="height"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : undefined"
    decoding="async"
  />
</template>

<style scoped lang="scss">
/**
 * height: auto 是必须的。
 * 有了它，浏览器才会用 width/height 属性去算「宽高比」并等比缩放；
 * 没有它，img 会死板地按属性里的像素值显示（3000px 宽），页面直接爆掉。
 */
img {
  max-width: 100%;
  height: auto;
}
</style>
