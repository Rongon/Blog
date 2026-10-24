<script setup lang="ts">
import type { PostMeta } from '@/data/posts'
import ResponsiveImage from '@/components/ResponsiveImage.vue'

withDefaults(defineProps<{ post: PostMeta; sizes?: string }>(), {
  // 默认按首页「最近写的」那张网格算：两列、列间距 28
  sizes: '(max-width: 899px) calc(100vw - 48px), (max-width: 1128px) calc((100vw - 76px) / 2), 502px',
})
</script>

<template>
  <article class="card">
    <RouterLink class="cover" :to="`/articles/${post.slug}`" tabindex="-1" aria-hidden="true">
      <ResponsiveImage :src="post.cover" :alt="post.title" :sizes="sizes" />
    </RouterLink>

    <div class="body">
      <h3>
        <RouterLink :to="`/articles/${post.slug}`">{{ post.title }}</RouterLink>
      </h3>
      <p class="sum">{{ post.summary }}</p>
      <div class="meta ui">
        <span class="tag">{{ post.category }}</span>
        <span>{{ post.date }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.card {
  border: 1px solid var(--rule-soft);
  background: var(--surface);
  display: flex;
  flex-direction: column;
}

.cover {
  display: block;
  border-bottom: 1px solid var(--rule-soft);

  &:hover {
    border-bottom-color: var(--rule-soft);
  }

  img {
    width: 100%;
    height: auto;
  }
}

.body {
  padding: 18px 20px 22px;

  h3 {
    font-size: 18px;
    line-height: 1.5;
    margin-bottom: 10px;

    a {
      color: var(--ink);

      &:hover {
        color: var(--link);
      }
    }
  }
}

.sum {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--faint);
}

.tag {
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 1px 8px;
  color: var(--muted);
}
</style>
