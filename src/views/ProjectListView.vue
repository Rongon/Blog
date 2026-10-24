<script setup lang="ts">
import ResponsiveImage from '@/components/ResponsiveImage.vue'
import { projects } from '@/data/projects'

// 这里是行式布局：左边缩略图固定 380px，右边正文；窄屏塌成单列
const THUMB_SIZES = '(max-width: 899px) calc(100vw - 48px), 380px'
</script>

<template>
  <!-- 站上只有一个项目，再摆一句「一个项目」的大标题纯属自说自话。
       但页面仍然需要一个 h1（读屏软件和搜索引擎靠它判断这一页是什么），
       所以留一个只有读屏软件能看到的标题，视觉上直接进内容。 -->
  <section class="list">
    <h1 class="sr-only">项目</h1>
    <div class="wrap">
      <article v-for="p in projects" :key="p.slug" class="prow">
        <div class="thumb">
          <RouterLink v-if="p.to" :to="p.to" tabindex="-1" aria-hidden="true">
            <ResponsiveImage :src="p.thumb" :alt="p.name" :sizes="THUMB_SIZES" />
          </RouterLink>
          <ResponsiveImage v-else :src="p.thumb" :alt="p.name" :sizes="THUMB_SIZES" />
        </div>

        <div class="body">
          <div class="kicker">{{ p.role }} · {{ p.period }}</div>
          <h2>
            <RouterLink v-if="p.to" :to="p.to">{{ p.name }}</RouterLink>
            <template v-else>{{ p.name }}</template>
          </h2>
          <p class="tl">{{ p.tagline }}</p>
          <p class="sum">{{ p.summary }}</p>

          <ul class="hi">
            <li v-for="h in p.highlights" :key="h">{{ h }}</li>
          </ul>

          <div class="foot">
            <div class="stack ui">
              <span v-for="s in p.stack" :key="s">{{ s }}</span>
            </div>
            <RouterLink v-if="p.to" class="more ui" :to="p.to">看细节 →</RouterLink>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

/* 只有读屏软件拿得到的标题：视觉上不占位，但 h1 还在 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.list {
  padding: 48px 0 56px;
}

.prow {
  display: grid;
  grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
  gap: 40px;
  padding: 44px 0;
  border-bottom: 1px solid var(--rule-soft);

  &:last-child {
    border-bottom: 0;
  }
}

.thumb {
  img {
    width: 100%;
    height: auto;
    border: 1px solid var(--rule-soft);
  }
}

h2 {
  font-size: 24px;
  margin-bottom: 10px;

  a {
    color: var(--ink);

    &:hover {
      color: var(--link);
    }
  }
}

.tl {
  margin: 0 0 12px;
  color: var(--ink);
  font-size: 16.5px;
  line-height: 1.8;
}

.sum {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 15.5px;
  line-height: 1.85;
}

.hi {
  margin: 0 0 20px;
  padding-left: 1.15em;
  color: var(--muted);
  font-size: 14.5px;
  line-height: 1.75;

  li {
    margin-bottom: 6px;
  }
}

.foot {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.stack {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12.5px;

  span {
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 1px 9px;
    color: var(--faint);
  }
}

.more {
  margin-left: auto;
  font-size: 14px;
  white-space: nowrap;
}

@include md-down {
  .prow {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 34px 0;
  }

  .more {
    margin-left: 0;
  }
}

@include sm-down {
  .head {
    padding: 40px 0 30px;
  }

  .prow {
    padding: 28px 0;
  }

  h2 {
    font-size: 21px;
  }
}
</style>
