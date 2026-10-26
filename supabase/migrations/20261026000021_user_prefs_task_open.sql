-- 환경 설정의 "작업 여는 방식". panel은 오른쪽 드로어, page는 전체 페이지
alter table public.user_prefs
  add column task_open text not null default 'panel' check (task_open in ('panel', 'page'));
