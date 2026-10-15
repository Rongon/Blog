<script setup lang="ts">
/**
 * 响应式图片。
 *
 * 【它解决什么】一张 3000px 宽的大图，在手机上会被缩到 375px 显示，
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
</script>

<template>
  <img :src="src" :srcset="srcset" :sizes="srcset ? sizes : undefined" :alt="alt" />
</template>
