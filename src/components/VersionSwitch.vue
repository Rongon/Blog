<script setup lang="ts">
/**
 * 快版 / 慢版切换控件。
 *
 * 位置：导航栏下方、右上角（fixed）。不放进导航栏 —— 那里是 首页/项目/文章/关于 这些真链接，
 * 塞一个对照开关进去会挤掉正事，观感上也像在导航里贴了块膏药。
 *
 * 慢版里那个控件是部署时注入的**同一份 HTML + 同一份 CSS**
 * （见 scripts/inject-version-switch.mjs 与 src/styles/version-switch.css）。
 * 两版的控件结构、位置、字号完全一致，只有高亮项不同 —— 这是对照实验最基本的控制变量。
 */
const naiveHref = `${import.meta.env.BASE_URL}naive/`
</script>

<template>
  <div class="vsw" role="group" aria-label="切换快版 / 慢版">
    <span class="on" aria-current="true">快版</span>
    <a :href="naiveHref">慢版</a>
  </div>
</template>
