<script setup lang="ts">
// 阶段 0：只做首屏骨架。文章列表 / 项目预览会在模块 2 补上。
</script>

<template>
  <section class="hero">
    <div class="wrap">
      <div class="kicker">前端工程师 · 2 年经验 · 广州</div>
      <h1>把页面做快，把话说清楚。</h1>
      <p class="lede">
        我做前端，也做性能优化。这个站点本身就是一个可测量的实验品——同一份内容，优化前和优化后各部署一版，数字都摆在明面上。
      </p>
      <div class="acts">
        <RouterLink class="btn" to="/projects">看项目</RouterLink>
        <RouterLink class="btn ghost" to="/articles">读文章</RouterLink>
      </div>
    </div>
  </section>

  <section class="ph wrap">
    <p class="kicker">待搭建</p>
    <p>首页的「最近写的」与「项目预览」两块会在模块 2 补上。</p>
  </section>
</template>

<style scoped lang="scss">
.hero {
  padding: 88px 0 64px;
  border-bottom: 1px solid var(--rule);
}

.kicker {
  margin-bottom: 22px;
}

h1 {
  font-size: clamp(34px, 5vw, 52px);
  letter-spacing: -0.02em;
  max-width: 16em;
}

.lede {
  margin: 22px 0 0;
  max-width: 34em;
  color: var(--muted);
  font-size: 18px;
  line-height: 1.85;
}

.acts {
  margin-top: 34px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 11px 20px;
  border-radius: var(--radius);
  border: 1px solid var(--ink);
  background: var(--ink);
  color: var(--bg);
  cursor: pointer;

  &:hover {
    opacity: 0.86;
    color: var(--bg);
    border-bottom-color: var(--ink);
  }

  &.ghost {
    background: none;
    color: var(--ink);
    border-color: var(--rule);

    &:hover {
      border-color: var(--ink);
      opacity: 1;
      color: var(--ink);
    }
  }
}

.ph {
  padding: 56px 24px;
  color: var(--faint);
}
</style>
