<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import GitHubLoginButton from '@/components/GitHubLoginButton.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ email: '', password: '' })

const rules: FormRules<typeof form> = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不对', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

/** 登录前想去的页面。评论区把人踢到登录页时会带上它，登录完送回去 */
const redirect = () => (typeof route.query.redirect === 'string' ? route.query.redirect : '/')

async function onSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await auth.signIn(form.email.trim(), form.password)
    ElMessage.success('登录成功')
    await router.replace(redirect())
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth">
    <div class="card">
      <div class="kicker ui">登录</div>
      <h1>欢迎回来</h1>
      <p class="note">登录之后就能在文章下面留言了。没有账号的话，先去注册一个。</p>

      <GitHubLoginButton />

      <div class="or ui"><span>或 用邮箱</span></div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="form"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            show-password
            placeholder="至少 6 位"
            @keyup.enter="onSubmit"
          />
        </el-form-item>

        <el-button type="primary" :loading="loading" class="submit" @click="onSubmit">
          登录
        </el-button>
      </el-form>

      <p class="switch ui">
        还没有账号？<RouterLink to="/register">去注册</RouterLink>
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
  max-width: 420px;
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
  margin-bottom: 26px;
}

.submit {
  width: 100%;
  margin-top: 6px;
}

.or {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0 16px;
  color: var(--faint);
  font-size: 12.5px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--rule);
  }

  span {
    flex: none;
  }
}

.switch {
  margin: 20px 0 0;
  font-size: 13.5px;
  color: var(--muted);
  text-align: center;
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
