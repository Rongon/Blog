-- =============================================================================
-- Blog · 评论区的数据库结构与权限
--
-- 用法：把整个文件贴到 Supabase 控制台的 SQL Editor 里，点 Run。可以重复执行。
--
-- 【这份文件在解决什么】
-- 评论区需要一个「谁能读、谁能写、谁能删」的规则。这件事有两种做法：
--   ① 写在应用代码里：每次查询前判断一下当前用户是谁
--   ② 写在数据库里：让数据库自己拒绝越权的请求
-- 我们选 ②，用的是 Postgres 的 RLS（行级安全）。
--
-- 为什么这是更好的做法：应用代码可以绕过（改前端、直接调 API、拿着 anon key
-- 用 curl 打过来），而数据库层面的规则绕不过。这也是为什么 anon key 可以
-- 直接放在前端代码里——它只是「匿名身份」，能做什么由下面的策略决定。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 评论表
-- -----------------------------------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- 评论挂在哪篇文章下。用 slug 而不是文章 id，
  -- 因为文章是构建期的静态文件，本来就没有数据库主键。
  post_slug   text not null,

  -- 作者。references auth.users 意味着用户注销时评论一起删（on delete cascade）。
  author_id   uuid not null references auth.users (id) on delete cascade,
  -- 作者昵称的快照。故意冗余一份：评论列表就不用再去 join 用户表，
  -- 而且以后用户改名，历史评论仍显示当时的名字（这是刻意的选择）。
  author_name text not null,

  body        text not null,

  -- 幂等键（客户端生成）。同一个人在同一条评论上重试时报同一个 client_id，
  -- 数据库靠下面的唯一约束把第二次挡掉，于是重复提交不会产生两条评论。
  client_id   text not null,

  constraint comments_body_length check (char_length(body) between 1 and 1000),
  constraint comments_name_length check (char_length(author_name) between 1 and 24),
  constraint comments_client_id_unique unique (author_id, client_id)
);

-- 列表查询是「按文章 + 时间倒序」，建一个正好对上这个顺序的索引
create index if not exists comments_post_slug_created_at_idx
  on public.comments (post_slug, created_at desc);


-- -----------------------------------------------------------------------------
-- 2. 打开 RLS
--    打开之后默认是「谁都不许」，必须逐条写策略放行。
--    这种默认值的价值在于：忘了写策略的后果是「读不到」，而不是「谁都能改」。
-- -----------------------------------------------------------------------------
alter table public.comments enable row level security;


-- -----------------------------------------------------------------------------
-- 3. 策略
-- -----------------------------------------------------------------------------

-- 读：所有人（含未登录访客）都能读
drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all"
  on public.comments
  for select
  using (true);

-- 写：只有已登录用户能写，而且作者必须是他自己
-- （with check 管的是「写进去的那一行」必须满足什么条件）
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments
  for insert
  to authenticated
  with check (auth.uid() = author_id);

-- 删：只能删自己的
-- （using 管的是「哪些已存在的行」允许被操作）
drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
  on public.comments
  for delete
  to authenticated
  using (auth.uid() = author_id);

-- 不做「更新」策略：没有 update 策略就等于禁止更新。
-- 第一版不支持编辑评论，这是有意的——编辑要处理版本、要处理「评论已删但引用还在」，
-- 不是现在该做的事。


-- -----------------------------------------------------------------------------
-- 4. 显式授权
--    建项目时我们关掉了「Automatically expose new tables」，
--    所以新表不会自动对 Data API 可见，需要在这里手动 grant。
--    grant 是「这张表允许被访问」，policy 是「允许访问哪些行」，两者缺一不可。
-- -----------------------------------------------------------------------------
grant select on public.comments to anon, authenticated;
grant insert, delete on public.comments to authenticated;


-- -----------------------------------------------------------------------------
-- 5. 频率限制：同一个人 30 秒内只能发一条
--    放在数据库里而不是前端：前端可以被绕过，数据库不会。
--    正常用户永远碰不到这条；刷屏的人会拿到一句明确的报错。
-- -----------------------------------------------------------------------------
create or replace function public.comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.comments
    where author_id = new.author_id
      and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_rate_limit_before_insert on public.comments;
create trigger comments_rate_limit_before_insert
  before insert on public.comments
  for each row
  execute function public.comments_rate_limit();
