/**
 * Supabase 客户端。
 *
 * 【它是什么】Supabase 是一个 BaaS（后端即服务）：它把「用户系统 + 数据库 + 权限」
 * 做成了现成的平台，我们只配置和使用，不写服务端代码。
 * 所以这个项目依然是纯前端——只是前端会对一个云服务发请求。
 *
 * 【为什么 key 可以直接放在前端】
 * anon / publishable key 只代表「匿名身份」，它不带任何特权。
 * 能读什么、能写什么，全部由数据库的 RLS 策略决定（见 supabase/schema.sql）。
 * 拿到这个 key 的人，能做的事和一个未登录的访客完全一样。
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    '缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY。请检查项目根目录的 .env 文件。',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // 登录状态存在 localStorage 里，刷新页面不用重新登录
    persistSession: true,
    // access token 过期前自动续期
    autoRefreshToken: true,
    // 单独起一个 key，免得和别的项目打架
    storageKey: 'p2026:auth',
  },
})
