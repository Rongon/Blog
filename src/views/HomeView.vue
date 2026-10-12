<script setup lang="ts">
import PostCard from '@/components/PostCard.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import { getRecentPosts } from '@/data/posts'
import { getFeaturedProjects } from '@/data/projects'

const recent = getRecentPosts(3)
const featured = getFeaturedProjects(2)
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

  <section class="sec">
    <div class="wrap">
      <div class="sec-head">
        <h2>最近写的</h2>
        <RouterLink to="/articles">全部文章 →</RouterLink>
      </div>
      <div class="grid cols-3">
        <PostCard v-for="p in recent" :key="p.slug" :post="p" />
      </div>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="sec-head">
        <h2>做过的项目</h2>
        <RouterLink to="/projects">全部项目 →</RouterLink>
      </div>
      <div class="grid cols-2">
        <ProjectCard v-for="p in featured" :key="p.slug" :project="p" />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

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

.sec {
  padding: 64px 0 0;

  &:last-of-type {
    padding-bottom: 40px;
  }
}

.grid {
  display: grid;
  gap: 28px;
}

.cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

@include md-down {
  .cols-3,
  .cols-2 {
    grid-template-columns: 1fr;
  }
}

@include sm-down {
  .hero {
    padding: 48px 0 36px;
  }
}
</style>
