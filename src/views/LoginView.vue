<script setup lang="ts">
/**
 * 登录入口。
 *
 * 【为什么还留着一页】正常情况下用不到它 —— 顶栏的「登录」和评论区的「用 GitHub 登录」
 * 都是直接开始授权，不经过这里。这一页只为两种情况存在：
 *   1. 别处（旧链接、文章、搜索结果）把人带到 `/login`
 *   2. 授权中途失败、Amazon 回不来时，得有个能看懂的地方，而不是一张白页
 *
 * 【为什么一进来就自己跳】带着 `.login-started` 标记自动开始一次授权，等于把
 * 「打开这个页面」变成「直接去 GitHub」。标记用 sessionStorage，跳之前写、几秒后清，
 * 这样授权失败落回本站时不会无限重跳。
 */
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import GitHubLoginButton from '@/components/GitHubLoginButton.vue'

const auth = useAuthStore()
const route = useRoute()

const STARTED_KEY = 'p2026:login-started'

onMounted(async () => {
  // 授权回来会带 ?code= / #error=...，那些不是「刚进来」，不要重跳
  const cameBack = window.location.search.includes('code=') || window.location.hash.includes('error')
  if (cameBack || sessionStorage.getItem(STARTED_KEY)) return

  sessionStorage.setItem(STARTED_KEY, '1')
  setTimeout(() => sessionStorage.removeItem(STARTED_KEY), 5000)

  try {
    const next = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await auth.signInWithGitHub(next)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'GitHub 登录没能开始')
  }
})
</script>

<template>
  <section class="auth">
    <div class="card">
      <div class="kicker ui">登录</div>
      <h1>正在跳到 GitHub…</h1>
      <p class="note">没跳过去的话，点下面的按钮。</p>

      <GitHubLoginButton />

      <dl class="facts ui">
        <div>
          <dt>会读到什么</dt>
          <dd>公开用户名和头像。私有仓库、邮箱、关注列表都读不到。</dd>
        </div>
        <div>
          <dt>发出去什么</dt>
          <dd>只有一条评论：昵称（GitHub 用户名）+ 内容 + 时间。</dd>
        </div>
        <div>
          <dt>想删掉呢</dt>
          <dd>每条评论右上角有「删除」，只能删自己的。</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/breakpoints' as *;

.auth {
  padding: 64px 24px 96px;
  display: flex;
  justify-content: center;
}

.card {
  width: 100%;
  max-width: 460px;
  border: 1px solid var(--rule);
  background: var(--surface);
  padding: 34px 34px 30px;

  h1 {
    font-size: 26px;
    margin-bottom: 10px;
  }
}

.kicker {
  margin-bottom: 14px;
}

.note {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
  margin-bottom: 22px;
}

.facts {
  margin: 26px 0 0;
  padding-top: 20px;
  border-top: 1px solid var(--rule);
  font-size: 13px;
  line-height: 1.75;

  div + div {
    margin-top: 14px;
  }

  dt {
    color: var(--ink);
    font-weight: 600;
  }

  dd {
    margin: 2px 0 0;
    color: var(--muted);
  }
}

@include sm-down {
  .auth {
    padding: 32px 16px 64px;
  }

  .card {
    padding: 26px 20px 22px;

    h1 {
      font-size: 23px;
    }
  }
}
</style>
