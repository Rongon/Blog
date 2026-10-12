<script setup lang="ts">
import type { ProjectMeta } from '@/data/projects'

defineProps<{ project: ProjectMeta }>()
</script>

<template>
  <article class="pcard">
    <RouterLink v-if="project.to" class="thumb" :to="project.to" tabindex="-1" aria-hidden="true">
      <img :src="project.thumb" :alt="project.name" />
    </RouterLink>
    <div v-else class="thumb" aria-hidden="true">
      <img :src="project.thumb" :alt="project.name" />
    </div>

    <div class="body">
      <div class="kicker">{{ project.role }} · {{ project.period }}</div>
      <h3>
        <RouterLink v-if="project.to" :to="project.to">{{ project.name }}</RouterLink>
        <template v-else>{{ project.name }}</template>
      </h3>
      <p class="tl">{{ project.tagline }}</p>
      <ul class="hi">
        <li v-for="h in project.highlights" :key="h">{{ h }}</li>
      </ul>
      <div class="stack ui">
        <span v-for="s in project.stack" :key="s">{{ s }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.pcard {
  border: 1px solid var(--rule-soft);
  background: var(--surface);
  display: flex;
  flex-direction: column;
}

.thumb {
  display: block;
  border-bottom: 1px solid var(--rule-soft);

  img {
    width: 100%;
    height: auto;
  }
}

.body {
  padding: 20px 22px 24px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.kicker {
  margin-bottom: 10px;
}

h3 {
  font-size: 20px;
  margin-bottom: 10px;

  a {
    color: var(--ink);

    &:hover {
      color: var(--link);
    }
  }
}

.tl {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 15.5px;
  line-height: 1.8;
}

.hi {
  margin: 0 0 18px;
  padding-left: 1.15em;
  color: var(--muted);
  font-size: 14.5px;
  line-height: 1.75;

  li {
    margin-bottom: 6px;
  }
}

.stack {
  margin-top: auto;
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
</style>
