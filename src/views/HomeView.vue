<script setup lang="ts">
import PostCard from '@/components/PostCard.vue'
import ResponsiveImage from '@/components/ResponsiveImage.vue'
import { getRecentPosts } from '@/data/posts'
import { prefetchRouteChunks } from '@/lib/prefetchRoutes'

// 优化项 9：首页画完之后，趁空闲把「点进去会去的页面」提前下载好。
// 只挂在首页 —— 这是访客真正会做「下一步选择」的地方。
prefetchRouteChunks()

/**
 * 告诉浏览器这些图在不同断点下会占多宽。
 * srcset 能不能挑对档位全靠它——写错就等于没优化，甚至更糟。
 * 这几个值是从下面的 CSS 反推出来的，改布局时记得回头看这里。
 */
// 题图在 .wrap 里：最大宽 1080，左右各 24 内边距
const BANNER_SIZES = '(max-width: 1128px) calc(100vw - 48px), 1032px'
// 照片墙是 .cols-3：三列、列间距 28，所以是三列之间减掉两个 28
const WALL_SIZES =
  '(max-width: 899px) calc(100vw - 48px), (max-width: 1128px) calc((100vw - 104px) / 3), 325px'

const recent = getRecentPosts(8)

/**
 * 首页的照片墙。
 * 引用的是原始尺寸的大图——优化前首页并没有生成缩略图，这也是首页会慢的主要原因。
 */
const photos = [
  { src: '/images/photos/coast-02.webp', alt: '浪与沙滩' },
  { src: '/images/photos/coast-03.webp', alt: '正午的海面' },
  { src: '/images/photos/coast-04.webp', alt: '回程路上' },
  { src: '/images/photos/coast-05.webp', alt: '浪打礁石' },
  { src: '/images/photos/coast-06.webp', alt: '远处的海岸线' },
  { src: '/images/photos/coast-07.webp', alt: '清早的海雾' },
  { src: '/images/photos/coast-08.webp', alt: '海边的树' },
  { src: '/images/photos/coast-09.webp', alt: '拍岸的浪' },
  { src: '/images/photos/coast-11.webp', alt: '礁石与浪花' },
]
</script>

<template>
  <section class="hero">
    <div class="wrap">
      <h1>我做大前端，也在做 AI 相关的东西。</h1>
      <p class="lede">
        这个站点本身就是一个可测量的实验品——同一份内容，优化前和优化后各部署一版，数字都摆在明面上。
      </p>
      <div class="acts">
        <RouterLink class="btn" to="/articles">读文章</RouterLink>
      </div>

      <!-- 首屏题图（首页的 LCP 元素）。
           已经有 srcset（手机不会再下这张 3000px 的图）；
           还没有 width/height（图没下来之前这块高度是 0，图一到位把下面全部推下去 = CLS）、
           也还没有 preload / fetchpriority（和另外 18 张图排在同一个队里）。
           剩下两项是后面的优化项，现在故意不做。 -->
      <figure class="banner">
        <ResponsiveImage
          src="/images/photos/coast-10.webp"
          alt="从高处看下去的海岸线"
          :sizes="BANNER_SIZES"
          eager
        />
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
        <h2>风景图片</h2>
        <RouterLink to="/articles/coastline">图集 →</RouterLink>
      </div>
      <div class="grid cols-3 photos">
        <ResponsiveImage
          v-for="ph in photos"
          :key="ph.src"
          :src="ph.src"
          :alt="ph.alt"
          :sizes="WALL_SIZES"
        />
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

// 这句比原来的短句长，16em 会把它挤成两行、末行只剩两个字
h1 {
  font-size: clamp(34px, 5vw, 52px);
  letter-spacing: -0.02em;
  max-width: 22em;
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

/* 网格。两个区块（最近写的 / 风景图片）共用同一套。 */
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

/* 照片墙：9 张的原始比例各不相同（有横有竖），直接按原比例铺会变成一排参差不齐的
   长短腿，行与行之间留下大片空白。统一裁成 4:3 —— 既整齐，也不用改动图片本身。
   用 aspect-ratio + object-fit，容器高度先由 CSS 占住，图片到得晚也不会跳（CLS 不受影响）。 */
.photos img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
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
