<script setup lang="ts">
/**
 * 「用 GitHub 登录」按钮。
 *
 * 【为什么单独一个组件】登录页要放它，评论区也要它的一份等价逻辑。
 * 对 OAuth 来说没有「注册」这个动作：GitHub 账号第一次来就是注册，来过一次就是登录，
 * 所以页面上不出现「注册」两个字，也不需要注册页。
 *
 * 【它不处理跳转】点下去之后是整页跳去 GitHub，函数返回与否都不影响浏览器行为。
 */
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const busy = ref(false)

async function onClick() {
  busy.value = true
  try {
    // 把「本来想去的页面」带上，授权回来之后 App.vue 会把人送回去
    const next = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await auth.signInWithGitHub(next)
  } catch (error) {
    busy.value = false
    ElMessage.error(error instanceof Error ? error.message : 'GitHub 登录没能开始')
  }
}
</script>

<template>
  <button type="button" class="gh" :disabled="busy" @click="onClick">
    <svg class="mark" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
    <span>{{ busy ? '正在跳转…' : '用 GitHub 登录' }}</span>
  </button>
</template>

<style scoped lang="scss">
.gh {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 11px 18px;
  border: 1px solid var(--ink);
  border-radius: var(--radius);
  background: none;
  color: var(--ink);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ink);
    color: var(--bg);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.mark {
  width: 16px;
  height: 16px;
  flex: none;
}
</style>
