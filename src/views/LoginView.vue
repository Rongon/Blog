<script setup lang="ts">
/**
 * 登录页。
 *
 * 【为什么只剩一个按钮】原来这里有「邮箱 + 密码」的表单，后来删了。
 * 原因不是嫌麻烦，是那条路证明不了任何事：
 *   · 免费版 Supabase 不能发验证邮件（每小时两封，且只发给项目成员），
 *     所以「确认邮箱」只能关掉 —— 谁都能填 `a@b.com` 注册。
 *   · 这样一来「邮箱」退化成一个用户名，冒用别人的邮箱零成本。
 *   · 而「忘记密码」「找回账号」全都依赖真实邮箱，两条路一起废掉。
 * 认证方式只有「能验证身份」和「不能验证身份」两种，留着后者等于给访客一个假承诺。
 *
 * GitHub OAuth 证明的是「这个人是某个 GitHub 账号的主人」，这是能验证的。
 * 对一个面向开发者的技术博客来说，这个覆盖面也够。
 *
 * 【为什么还留这一页】两个原因：一是评论区的「去登录」需要一个落地页，
 * 二是授权中途出错时得有个能看懂的地方，而不是把错误直接甩给 GitHub。
 */
import { useRoute } from 'vue-router'
import GitHubLoginButton from '@/components/GitHubLoginButton.vue'

// 只有一处用到：按钮会把用户送回他想去的那一页（由 query.redirect 决定）
const route = useRoute()
const from = typeof route.query.redirect === 'string' ? route.query.redirect : ''
</script>

<template>
  <section class="auth">
    <div class="card">
      <div class="kicker ui">登录</div>
      <h1>留言需要先登录</h1>
      <p class="note">用 GitHub 账号登录，站内不存你的密码。</p>

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

      <p v-if="from" class="back ui">
        登录成功后会回到<a :href="from">你刚才那一页</a>。
      </p>
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
    font-size: 28px;
    margin-bottom: 12px;
  }
}

.kicker {
  margin-bottom: 14px;
}

.note {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
  margin-bottom: 24px;
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

.back {
  margin: 20px 0 0;
  font-size: 13px;
  color: var(--muted);
}

@include sm-down {
  .auth {
    padding: 32px 16px 64px;
  }

  .card {
    padding: 26px 20px 22px;

    h1 {
      font-size: 24px;
    }
  }
}
</style>
