-- ランキング用のテーブル。Supabase の SQL Editor に貼り付けて実行する。

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 12),
  distance real not null check (distance >= 0 and distance <= 100000),
  created_at timestamptz not null default now()
);

-- 距離の降順で上位を取るためのインデックス
create index if not exists scores_distance_idx on public.scores (distance desc);

-- 行レベルセキュリティを有効化し、anon（ブラウザ）には読み取りと追加だけを許可する（更新・削除は不可）
alter table public.scores enable row level security;

drop policy if exists "scores_select_anon" on public.scores;
create policy "scores_select_anon" on public.scores
  for select to anon using (true);

drop policy if exists "scores_insert_anon" on public.scores;
create policy "scores_insert_anon" on public.scores
  for insert to anon with check (true);

-- テーブル権限も select / insert だけにする
revoke all on public.scores from anon;
grant select, insert on public.scores to anon;
