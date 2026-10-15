<script setup lang="ts">
import PostCard from '@/components/PostCard.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import { getRecentPosts } from '@/data/posts'
import { getFeaturedProjects } from '@/data/projects'

const recent = getRecentPosts(8)
const featured = getFeaturedProjects(3)

/**
 * 首页的照片墙。
 *
 * 注意这里直接引的就是原始尺寸的大图（3000px、单张一到三兆）——
 * 首页并没有生成缩略图。这是「优化前」的样子，也是首页会慢的主要原因。
 * 阶段 3 会加上缩略图 / srcset / 懒加载 / 宽高，然后重新测一遍。
 */
const photos = [
  { src: '/images/photos/coast-02.jpg', alt: '浪与沙滩' },
  { src: '/images/photos/coast-03.jpg', alt: '正午的海面' },
  { src: '/images/photos/coast-04.jpg', alt: '回程路上' },
  { src: '/images/photos/coast-05.jpg', alt: '浪打礁石' },
  { src: '/images/photos/coast-06.jpg', alt: '远处的海岸线' },
  { src: '/images/photos/coast-07.jpg', alt: '清早的海雾' },
  { src: '/images/photos/coast-08.jpg', alt: '海边的树' },
  { src: '/images/photos/coast-09.jpg', alt: '拍岸的浪' },
  { src: '/images/photos/coast-11.jpg', alt: '礁石与浪花' },
]
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

      <!-- 首屏题图。它是首页的 LCP 元素，现在是这样的：
           没有 width/height（图没下来之前这块高度是 0，图一到位把下面全部推下去 = CLS）、
           没有 preload / fetchpriority（和另外 18 张图排在同一个队里）、
           没有 srcset（手机也去下这张 3000px 的图）。
           三项都是阶段 3 的优化项，现在故意不做。 -->
      <figure class="banner">
        <img src="/images/photos/coast-10.jpg" alt="从高处看下去的海岸线" />
        <figcaption class="ui">题图 · 海岸线，下午四点</figcaption>
      </figure>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="sec-head">
        <h2>最近写的</h2>
        <RouterLink to="/articles">全部文章 →</RouterLink>
      </div>
      <!-- 两列而不是三列：卡片的封面就成了首屏最大的那批图。
           优化前的封面是 3000px 的原始 JPG，显示宽度却有 500px —— 这批图会一张一张慢慢挤进来。 -->
      <div class="grid cols-2">
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
      <div class="grid cols-3">
        <ProjectCard v-for="p in featured" :key="p.slug" :project="p" />
      </div>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="sec-head">
        <h2>最近拍的</h2>
        <RouterLink to="/articles/coastline">那篇图集 →</RouterLink>
      </div>
      <div class="grid cols-3 photos">
        <img v-for="ph in photos" :key="ph.src" :src="ph.src" :alt="ph.alt" />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.hero {
  padding: 88px 0 48px;
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

/* 首屏题图。
   收在 .wrap（最大 1080px）里，不是通栏铺满 —— 通栏大图会把版面压垮，
   而且正文栏宽只有 720px，题图比正文宽一点点就够了，再加一行图注。 */
.banner {
  margin: 48px 0 0;

  img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--rule-soft);
  }

  figcaption {
    font-size: 12.5px;
    color: var(--faint);
    margin-top: 9px;
  }
}

.sec {
  padding: 64px 0 0;

  &:last-of-type {
    padding-bottom: 40px;
  }
}

/* 网格。三个区块（最近写的 / 做过的项目 / 最近拍的）共用同一套。 */
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

.photos img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--rule-soft);
}

@include md-down {
  .cols-3,
  .cols-2 {
    grid-template-columns: 1fr;
  }

  .grid {
    gap: 22px;
  }
}

@include sm-down {
  .hero {
    padding: 36px 0 32px;
  }

  .banner {
    margin-top: 30px;
  }

  .sec {
    padding: 44px 0 0;
  }
}
</style>
