-- 표시 언어(다국어 1단계). profiles.locale에 사용자가 고른 로캘을 저장하고 본인만 바꾸게 한다.
-- 기존 profiles_update 정책(본인 행만)이 행을 자르고, 열 단위 grant에 locale을 더한다.

alter table public.profiles
  add column locale text not null default 'ko'
  check (locale in ('ko', 'en', 'ja', 'zh-CN'));

grant update (locale) on public.profiles to authenticated;
