<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PlaceholderPage from '@/components/PlaceholderPage.vue'
import { getAdjacentProjects, getProjectBySlug } from '@/data/projects'

const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const project = computed(() => getProjectBySlug(slug.value))
const adjacent = computed(() => getAdjacentProjects(slug.value))

/** 把 `**加粗**` 拆成片段，模板里用 <strong> 渲染——不引 v-html，也就不存在 XSS 面。 */
function splitBold(s: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false })
    // 正则里只有一个捕获组，m[1] 一定存在；写 ?? '' 是为了让 noUncheckedIndexedAccess
    // 也能过，否则这里会变成 string | undefined。宁可多一个显式兜底，也不要关掉那个检查。
    out.push({ text: m[1] ?? '', bold: true })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false })
  return out
}
</script>

<template>
  <div v-if="project" class="wrap">
    <RouterLink class="back ui" to="/projects">← 回到项目列表</RouterLink>

    <header class="head">
      <div class="kicker">{{ project.role }} · {{ project.period }}</div>
      <h1>{{ project.name }}</h1>
      <p class="lede">{{ project.tagline }}</p>
      <p class="sum">{{ project.summary }}</p>

      <div class="stack ui">
        <span v-for="s in project.stack" :key="s">{{ s }}</span>
      </div>

      <div v-if="project.links?.length" class="links">
        <a
          v-for="l in project.links"
          :key="l.href"
          :href="l.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ l.label }} ↗
        </a>
      </div>
    </header>

    <div class="measure body">
      <section v-for="sec in project.sections" :key="sec.heading" class="sec">
        <h2>{{ sec.heading }}</h2>
        <p v-for="(t, i) in sec.paragraphs" :key="i">{{ t }}</p>
        <ul v-if="sec.bullets?.length">
          <li v-for="(b, i) in sec.bullets" :key="i">
            <template v-for="(seg, j) in splitBold(b)" :key="j">
              <strong v-if="seg.bold">{{ seg.text }}</strong>
              <template v-else>{{ seg.text }}</template>
            </template>
          </li>
        </ul>
      </section>
    </div>

    <nav v-if="adjacent.prev || adjacent.next" class="adj ui">
      <RouterLink v-if="adjacent.prev" :to="`/projects/${adjacent.prev.slug}`">
        前一个项目 · {{ adjacent.prev.name }}
      </RouterLink>
      <RouterLink v-if="adjacent.next" :to="`/projects/${adjacent.next.slug}`">
        后一个项目 · {{ adjacent.next.name }}
      </RouterLink>
    </nav>
  </div>

  <PlaceholderPage v-else title="没有这个项目" note="可能链接过期了，回到项目列表看看。" />
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.wrap {
  padding: 40px 24px 72px;
  max-width: var(--wide);
  margin: 0 auto;
}

.back {
  display: inline-block;
  font-size: 13.5px;
  color: var(--faint);

  &:hover {
    color: var(--link);
  }
}

.head {
  padding: 26px 0 34px;
  border-bottom: 1px solid var(--rule);
}

.kicker {
  margin-bottom: 16px;
}

h1 {
  font-size: clamp(28px, 4vw, 40px);
  letter-spacing: -0.02em;
}

.lede {
  margin: 18px 0 0;
  max-width: 32em;
  font-size: 18px;
  line-height: 1.85;
}

.sum {
  margin: 14px 0 0;
  max-width: 38em;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.85;
}

.stack {
  margin-top: 22px;
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

.links {
  margin-top: 18px;
  display: flex;
  gap: 18px;
  font-size: 14.5px;
}

.body {
  padding-top: 40px;
}

.sec {
  margin-bottom: 44px;

  h2 {
    font-size: 22px;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--rule-soft);
  }

  p {
    color: var(--ink);
    line-height: 1.9;
  }

  ul {
    margin: 0 0 1.2em;
    padding-left: 1.25em;
    color: var(--muted);
    line-height: 1.85;

    li {
      margin-bottom: 10px;
    }
  }

  strong {
    color: var(--ink);
  }
}

.adj {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding-top: 28px;
  border-top: 1px solid var(--rule);
  font-size: 14px;

  a {
    color: var(--link);
  }
}

@include sm-down {
  .wrap {
    padding: 24px 16px 56px;
  }

  .head {
    padding: 20px 0 26px;
  }

  h1 {
    font-size: 26px;
  }

  .lede {
    font-size: 16.5px;
  }

  .body {
    padding-top: 30px;
  }

  .sec h2 {
    font-size: 19px;
  }
}
</style>
