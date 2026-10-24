<script setup lang="ts">
/**
 * 【这是「慢版」专用的图片组件】
 *
 * 它不是另一个设计，而是同一个站点的**优化前实现**：
 * 一个 <img>，一个 src，指向原图，别的什么都不给。
 * 没有 srcset、没有 sizes、没有 width/height、没有懒加载、没有 fetchpriority。
 *
 * 换句话说，优化项 2（响应式图片）、3（懒加载）、4（宽高属性）在这份组件里
 * 全部退回到加之前的样子。这样两版页面的结构和文案才能完全一致，
 * 差别只落在「实现」上 —— 这才是可对照的实验。
 *
 * 只在 `--mode naive` 构建时通过 vite.config.ts 的 alias 生效，
 * 快版的产物里不含这个文件。
 */

import { computed } from 'vue'
import { asset } from '@/lib/asset'

const props = defineProps<{
  /** 全尺寸图的站点内路径，例如 /images/photos/coast-10.webp */
  src: string
  alt: string
  /** 快版用来告诉浏览器「显示多宽」；慢版不优化图片，收了不用，只为两边 props 一致 */
  sizes?: string
  eager?: boolean
}>()

/**
 * 慢版用原图。
 *
 * 仓库里的原图是 3000px 宽的 JPG，放在 raw-images/ 下（不在 public 里，
 * 免得被打进主站产物）。构建慢版时会被拷到 dist-naive/images/ 下同名的 .jpg。
 * 所以这里把 .webp 换成 .jpg 就够了。
 */
const src = computed(() => asset(props.src.replace(/\.webp$/i, '.jpg')))
</script>

<template>
  <img :src="src" :alt="alt" />
</template>

<style scoped lang="scss">
img {
  max-width: 100%;
  height: auto;
}
</style>
