/**
 * 登录态在 localStorage 里的键，以及一个「同步看一眼有没有登录过」的小函数。
 *
 * 【为什么单独一个文件】这个常量有两处要用，而这两处的要求正好相反：
 *   1. `src/lib/supabase.ts` —— 传给 createClient 的 storageKey。那里会把 Supabase SDK 打进包里。
 *   2. `src/layouts/DefaultLayout.vue` —— 顶栏要**在加载任何 JS 之前**就判断出「这个访客登录过没有」。
 *      那里绝对不能 import 任何跟 SDK 有关的东西，否则优化项 8 就白做了。
 *
 * 把常量放在这个「零依赖」的文件里，两处都能引，而顶栏那一处引完也只有几百字节。
 */

export const AUTH_STORAGE_KEY = 'p2026:auth'

/**
 * 本地有没有一份已保存的 session。
 *
 * 注意它只能回答「有没有」，不能回答「这份 session 还有效吗」——
 * 有效性得问真正的 SDK（token 可能早就过期了）。
 * 所以它只用来决定**要不要把登录组件装上**，不用来决定「显示登录还是显示昵称」。
 */
export function hasStoredSession(): boolean {
  try {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    // Safari 无痕模式等场景下访问 localStorage 会直接抛异常，当作未登录即可
    return false
  }
}
