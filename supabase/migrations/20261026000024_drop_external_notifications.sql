-- 이메일·푸시 발송 기능을 접으면서 23번 마이그레이션이 만든 푸시 구독 테이블과 발송 컬럼을 지운다.
-- 23번은 이미 원격에 적용돼 있어 고치지 않고 새 마이그레이션으로 되돌린다.
drop table if exists public.push_subscriptions;
drop index if exists public.notifications_unsent_idx;
alter table public.notifications
  drop column if exists emailed_at,
  drop column if exists pushed_at,
  drop column if exists dispatch_attempts;
