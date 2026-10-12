<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ name: '', email: '', password: '', confirm: '' })

const rules: FormRules<typeof form> = {
  name: [
    { required: true, message: '取个昵称，会显示在评论旁边', trigger: 'blur' },
    { min: 1, max: 24, message: '1–24 个字', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不对', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '再输一遍密码', trigger: 'blur' },
    {
      // 自定义校验：两次密码必须一致
      validator: (_rule, value: string, callback) => {
        if (value !== form.password) callback(new Error('两次输入的密码不一样'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function onSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const { needsEmailConfirm } = await auth.signUp(form.email.trim(), form.password, form.name)

    if (needsEmailConfirm) {
      ElMessage.warning('注册成功，但还需要去邮箱点一下确认链接才能登录。')
      await router.replace('/login')
      return
    }

    ElMessage.success('注册成功，已经帮你登录了')
    await router.replace('/')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth">
    <div class="card">
      <div class="kicker ui">注册</div>
      <h1>建个账号</h1>
      <p class="note">
        评论要登录才能发，这样每条留言都有主人。密码由 Supabase 的登录服务保管，本站看不到明文。
      </p>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="form"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="昵称" prop="name">
          <el-input v-model="form.name" maxlength="24" placeholder="评论旁边显示的名字" />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            type="password"
            autocomplete="new-password"
            show-password
            @keyup.enter="onSubmit"
          />
        </el-form-item>

        <el-button type="primary" :loading="loading" class="submit" @click="onSubmit">
          注册
        </el-button>
      </el-form>

      <p class="switch ui">
        已经有账号了？<RouterLink to="/login">去登录</RouterLink>
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
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

.switch {
  margin: 20px 0 0;
  font-size: 13.5px;
  color: var(--muted);
  text-align: center;
}
</style>
