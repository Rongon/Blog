/**
 * 登录状态。
 *
 * 【为什么用 Pinia】登录状态要被很多互不相关的组件读：顶栏（显示昵称/退出）、
 * 评论区（决定是显示输入框还是「登录后评论」）、登录页（登录成功后跳回去）。
 * 靠 props 一层层传会很痛苦，所以放在一个全局 store 里。
 *
 * 【它是唯一真相源吗】不是。真正的真相源是 Supabase 的 session（存在 localStorage 里）。
 * 这个 store 只是它的一份镜像，并用 onAuthStateChange 保持同步。
 * 为什么要镜像：读取同步、能直接用在 computed 里，不用每次都 await 一次 SDK。
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session } from '@supabase/supabase-js'
import { supabase, SUPABASE_URL } from '@/lib/supabase'

/** 把 Supabase 的英文报错翻成用户看得懂的话 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return '邮箱或密码不对。'
  if (m.includes('user already registered')) return '这个邮箱已经注册过了，直接登录吧。'
  if (m.includes('password should be at least')) return '密码至少要 6 位。'
  if (m.includes('email not confirmed')) {
    return '邮箱还没验证。要么去邮箱点确认链接，要么在 Supabase 后台把「Confirm email」关掉。'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return '操作太频繁了，等一会儿再试（免费版发验证邮件有额度限制）。'
  }
  if (m.includes('unable to validate email')) return '邮箱格式看起来不对。'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'GitHub 登录还没在 Supabase 后台开启。'
  }
  if (m.includes('oauth')) return '第三方登录没能完成，可以试试用邮箱登录。'
  return message
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  /** 首次 getSession 是否已经完成。没完成之前不要急着显示「未登录」 */
  const ready = ref(false)

  const user = computed(() => session.value?.user ?? null)
  const isLoggedIn = computed(() => Boolean(user.value))

  /**
   * 评论区显示的名字。按顺序找：
   * 1. 注册时自己填的 display_name
   * 2. GitHub 来的 full_name / name（真实姓名，可能没有）
   * 3. GitHub 用户名（一定会有）
   * 4. 邮箱 @ 前面那段（邮箱登录的老用户）
   * 5. 实在没有再兜底「匿名」
   */
  const displayName = computed(() => {
    const u = user.value
    if (!u) return ''
    const meta = u.user_metadata as
      | { display_name?: string; user_name?: string; full_name?: string; name?: string }
      | undefined
    return (
      meta?.display_name?.trim() ||
      meta?.full_name?.trim() ||
      meta?.user_name?.trim() ||
      meta?.name?.trim() ||
      u.email?.split('@')[0] ||
      '匿名'
    )
  })

  let started = false

  /**
   * 应用启动时调一次。
   * 先去读本地已有的 session（刷新页面不用重新登录），再订阅后续变化。
   */
  async function init() {
    if (started) return
    started = true

    const { data } = await supabase.auth.getSession()
    session.value = data.session
    ready.value = true

    // 登录、登出、token 续期都会走到这里，让 store 始终等于真实状态
    supabase.auth.onAuthStateChange((_event, next) => {
      session.value = next
    })
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new AuthError(translateAuthError(error.message))
    session.value = data.session
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // 昵称存进 user_metadata，注册后不用再建一张「用户资料表」
      options: { data: { display_name: displayName.trim() } },
    })
    if (error) throw new AuthError(translateAuthError(error.message))

    // 如果后台开了「Confirm email」，这里 session 是 null —— 需要用户先去邮箱点确认。
    // 关掉之后就是注册即登录。页面靠返回值判断该提示哪一句。
    session.value = data.session
    return { needsEmailConfirm: !data.session }
  }

  /**
   * 用 GitHub 登录。
   *
   * 【它做了什么】浏览器会整页跳到 GitHub 的授权页，用户在那边点「Authorize」，
   * GitHub 回调到 Supabase 的域名，Supabase 换到 GitHub 的资料、在 auth.users 里
   * 建好用户、再把人送回本站首页。回来的地址上带一段 #access_token=...，
   * SDK 在初始化时自己把它读掉并清掉，所以这里不需要处理返回值。
   *
   * 【nextPath 是干什么的】从文章页点登录时，把当前地址存进 sessionStorage，
   * 回到站点后由 App.vue 负责再送回去 —— 因为这一跳是整页刷新，Vue 的状态全没了。
   */
  /**
   * GitHub provider 有没有在 Supabase 后台打开？
   *
   * 【为什么要先问一次】没打开时点按钮会整页跳到 Supabase 的 authorize 地址，
   * 那边直接回一段 JSON 报错 —— 用户就被甩到一个白底黑字的错误页上，回不来了。
   * 先查一次 settings，没开就在原地提示，体验好得多。
   * 查不到（网络问题）就放行，不因为一次探测失败把登录挡死。
   */
  async function isGitHubEnabled(): Promise<boolean> {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      })
      const json = (await res.json()) as { external?: { github?: boolean } }
      return Boolean(json.external?.github)
    } catch {
      return true
    }
  }

  async function signInWithGitHub(nextPath = '/'): Promise<void> {
    if (nextPath && nextPath !== '/') {
      sessionStorage.setItem('p2026:after-login', nextPath)
    }
    if (!(await isGitHubEnabled())) {
      throw new AuthError('GitHub 登录还没开启，先用邮箱登录吧。')
    }
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    })
    if (error) throw new AuthError(translateAuthError(error.message))
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
  }

  return {
    session,
    ready,
    user,
    isLoggedIn,
    displayName,
    init,
    signIn,
    signUp,
    signInWithGitHub,
    signOut,
  }
})
