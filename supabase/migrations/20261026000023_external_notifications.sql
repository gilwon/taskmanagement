-- 이메일·푸시 발송용 컬럼과 푸시 구독 테이블. 발송 시각은 서비스 롤(dispatch 라우트)만 채운다.
-- notifications는 이미 update 권한이 read_at 한 컬럼뿐이라 새 컬럼은 사용자가 바꿀 수 없다(별도 grant 없음).

alter table public.notifications
  add column emailed_at timestamptz,
  add column pushed_at timestamptz,
  -- 발송 실패 횟수. 한도를 넘으면 dispatch가 시각을 채워 더는 재시도하지 않는다
  add column dispatch_attempts smallint not null default 0;

-- 아직 보내지 않은 알림만 담는 부분 인덱스(발송 대상 조회용)
create index notifications_unsent_idx on public.notifications (created_at)
  where emailed_at is null or pushed_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 1 and 2048),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- 본인 행만 조회·등록·삭제한다. 수정은 열지 않는다(바꾸려면 지우고 다시 등록)
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon;
revoke update on public.push_subscriptions from authenticated;
