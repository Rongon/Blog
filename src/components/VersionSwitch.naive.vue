<script setup lang="ts">
/**
 * 快版 / 慢版切换控件 —— 慢版里的那一份。
 *
 * 和快版的 VersionSwitch.vue 是**同一段模板、同一个 class、同一份 CSS**
 * （样式统一在 src/styles/version-switch.css，两版都 import 它）。
 * 唯一差别：这里高亮的是「慢版」，「快版」是可点的那个。
 *
 * 为什么不做成一个组件里判断 mode：
 * 那样快版的产物里会带着一份「慢版分支」的死代码，而这份死代码正好是
 * 「慢版才会走的路」—— 说起来小事，但对照实验里能不引入差异就不引入。
 */

/** 从 /Program2026/naive/ 去掉尾部的 naive/，得到快版首页 /Program2026/ */
const fastHref = import.meta.env.BASE_URL.replace(/naive\/$/, '')
</script>

<template>
  <div class="vsw" role="group" aria-label="切换优化后 / 优化前">
    <a :href="fastHref">优化后</a>
    <span class="on" aria-current="true">优化前</span>
  </div>
</template>
