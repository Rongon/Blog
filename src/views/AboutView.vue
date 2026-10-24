<script setup lang="ts">
/**
 * 关于我。
 *
 * 这里的文案是**占位**：结构先定下来，措辞与取舍等站点基本做完后你自己筛一遍——
 * 哪些写、哪些不写，你说了算。
 */

const contact = [
  { label: 'GitHub', value: 'github.com/Rongon', href: 'https://github.com/Rongon' },
]

const skills: { group: string; items: string[] }[] = [
  { group: '语言', items: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS'] },
  { group: '框架', items: ['Vue 3', 'React', 'uni-app'] },
  { group: '工程化', items: ['Vite', 'Webpack', 'pnpm', 'ESLint / Prettier', 'Git'] },
  { group: '常用库', items: ['Vue Router', 'Pinia', 'Element Plus', 'Axios'] },
]

const timeline = [
  {
    period: '2023 - 至今',
    title: '前端开发 · 广州',
    note: '中后台系统、企业内部低代码搭建平台；团队里负责页面搭建与物料组件。',
  },
  {
    period: '2019 - 2023',
    title: '江苏科技大学 · 物联网工程 · 本科',
    note: '主修课程：计算机网络、数据结构与算法、操作系统、数据库系统概论。',
  },
]
</script>

<template>
  <section class="head">
    <div class="wrap">
      <div class="kicker">关于</div>
      <h1>你好，我是曾泽龙。</h1>
          <p class="lede">
        前端工程师，两年经验，在<strong>广州</strong>。日常工作写中后台，也做内部低代码平台。这个站点是我自己搭的，用来放文章。
      </p>
    </div>
  </section>

  <section class="body">
    <div class="wrap cols">
      <div class="main">
        <section class="sec">
          <h2>我在做什么</h2>
          <p>
            工作中主要写中后台系统：表单、表格、详情、权限，这类页面重复度高、细节多。后来参与公司的低代码搭建平台，把其中一部分从「写」变成「配」。
          </p>
          <p>
            业余时间在准备这个站点。它没什么花哨功能，但我把「怎么验证一件事真的变快了」当成一个正经问题在做：同一份内容部署两个版本，数字都留在站内，谁都可以自己点开对比。
          </p>
        </section>

        <section class="sec">
          <h2>我平时用什么</h2>
          <div v-for="g in skills" :key="g.group" class="skill-row">
            <div class="ui skill-label">{{ g.group }}</div>
            <div class="skill-items ui">
              <span v-for="s in g.items" :key="s">{{ s }}</span>
            </div>
          </div>
        </section>

        <section class="sec">
          <h2>经历</h2>
          <ul class="tl">
            <li v-for="t in timeline" :key="t.period">
              <div class="tl-period ui">{{ t.period }}</div>
              <div class="tl-title">{{ t.title }}</div>
              <div class="tl-note">{{ t.note }}</div>
            </li>
          </ul>
        </section>

        <section class="sec">
          <h2>这个站是怎么做的</h2>
          <ul>
            <li>纯前端，没有自己的后端：内容以 Markdown 存在仓库里，构建时编译成页面。</li>
            <li>登录与评论走云服务；数据层抽成适配器，换实现不影响页面代码。</li>
            <li>性能优化做了逐项实测，站内有优化前后两个版本可以对照。</li>
          </ul>
          <p class="more">
            <RouterLink to="/articles/first-screen-30mb-to-1mb">这个站是怎么优化的 →</RouterLink>
          </p>
        </section>
      </div>

      <aside class="aside">
        <div class="card">
          <div class="ui card-title">联系方式</div>
          <ul class="contact">
            <li v-for="c in contact" :key="c.label">
              <span class="ui label">{{ c.label }}</span>
              <a v-if="c.href" :href="c.href" target="_blank" rel="noopener noreferrer">
                {{ c.value }} ↗
              </a>
              <span v-else class="ui pending">{{ c.value }}</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.head {
  padding: 72px 0 48px;
  border-bottom: 1px solid var(--rule);
}

.kicker {
  margin-bottom: 18px;
}

h1 {
  font-size: clamp(30px, 4vw, 42px);
  letter-spacing: -0.02em;
}

.lede {
  margin: 20px 0 0;
  max-width: 34em;
  color: var(--muted);
  font-size: 18px;
  line-height: 1.85;

  strong {
    color: var(--ink);
  }
}

.body {
  padding: 48px 0 64px;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 64px;
  align-items: start;
}

.main {
  max-width: var(--measure);
}

.sec {
  margin-bottom: 46px;

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
}

.skill-row {
  display: flex;
  gap: 18px;
  padding: 10px 0;
  border-bottom: 1px solid var(--rule-soft);

  &:last-child {
    border-bottom: 0;
  }
}

.skill-label {
  flex: 0 0 64px;
  font-size: 12.5px;
  color: var(--faint);
  padding-top: 3px;
}

.skill-items {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;

  span {
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 2px 10px;
    color: var(--muted);
  }
}

.tl {
  list-style: none;
  padding-left: 0 !important;
  margin: 0;

  li {
    position: relative;
    padding-left: 22px;
    padding-bottom: 22px;
    border-left: 1px solid var(--rule);
    margin-left: 3px;

    &::before {
      content: '';
      position: absolute;
      left: -4px;
      top: 8px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--link);
    }

    &:last-child {
      border-left-color: transparent;
      padding-bottom: 0;
    }
  }
}

.tl-period {
  font-size: 12.5px;
  color: var(--faint);
  margin-bottom: 4px;
}

.tl-title {
  color: var(--ink);
  margin-bottom: 4px;
}

.tl-note {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
}

.more {
  a {
    font-size: 15px;
  }
}

.aside {
  position: sticky;
  top: 88px;
}

.card {
  border: 1px solid var(--rule-soft);
  background: var(--surface);
  padding: 18px 20px 20px;
}

.card-title {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 14px;
}

.contact {
  list-style: none;
  margin: 0;
  padding: 0 !important;

  li {
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .label {
    display: block;
    font-size: 12px;
    color: var(--faint);
    margin-bottom: 3px;
  }
}

.pending {
  font-size: 13px;
  color: var(--faint);
}

@include md-down {
  .cols {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .aside {
    position: static;
    order: 2;
  }
}

@include sm-down {
  .head {
    padding: 40px 0 30px;
  }

  .lede {
    font-size: 16.5px;
  }

  .skill-row {
    flex-direction: column;
    gap: 6px;
  }

  .skill-label {
    flex: none;
    padding-top: 0;
  }
}
</style>
