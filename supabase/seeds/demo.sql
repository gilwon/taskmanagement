-- 데모 로그인용 시드. 데모 워크스페이스 "데모 스튜디오"(slug demo)를 지우고 처음 상태로 다시 넣는다.
--
-- 경고. 로컬 Supabase 스택 전용이다. 운영·원격 DB에 실행하지 않는다.
-- 직접 실행하지 말고 scripts/db-demo.sh(pnpm db:demo)로 넣는다(로컬 대상 확인, Storage 객체 정리 후 한 트랜잭션).
-- dev.sql과 독립이다. 다른 워크스페이스와 계정은 건드리지 않는다.
-- 모든 날짜는 실행 시점 기준 상대값(current_date + n, now() - interval)이다.
--
-- 로그인 계정. 데모 계정 주소와 비밀번호는 서버 환경변수 DEMO_EMAIL·DEMO_PASSWORD에서 psql이 읽는다.
-- 이 파일·저장소에는 비밀번호를 적지 않는다. 다른 데모 구성원은 실행마다 무작위 비밀번호이고 banned_until로 막아
-- 로그인도, Mailpit 재설정 메일로 계정을 가져가는 것도 할 수 없다.
-- 데모가 만든 계정은 raw_app_meta_data.demo_seed = true로 표시하고, 초기화 때 이 표시가 있는 계정만 지운다.
-- 데모 워크스페이스는 slug가 아니라 "구성원이 모두 demo_seed 계정인 워크스페이스"로 찾는다(admin이 slug를 바꿔도 지운다).
--   (DEMO_EMAIL)              데모 사용자  프로젝트 매니저     demo admin
--   hana.song@demo.example.com    송하나  대표              demo owner
--   woojin.bae@demo.example.com   배우진  프론트엔드 엔지니어 demo member
--   eunji.seo@demo.example.com    서은지  UX 디자이너        demo member
--   hyunwoo.nam@demo.example.com  남현우  백엔드 엔지니어    demo member
--   yerin.kwon@demo.example.com   권예린  마케터            demo member

set client_encoding = 'UTF8';

\getenv demo_email DEMO_EMAIL
\getenv demo_password DEMO_PASSWORD

-- ─────────────────────────────────────────────
-- 조회 헬퍼(이 세션에서만 존재)
-- ─────────────────────────────────────────────
-- 자격은 이 표에만 담고 아래 문장은 표를 읽는다. 오류 메시지에 값이 찍히지 않게 한다.
create temp table demo_auth (email text not null, pw text not null);
insert into demo_auth values (lower(btrim(:'demo_email')), :'demo_password');

create temp table demo_people (
  local text primary key,
  email text not null unique,
  name text not null,
  title text,
  color text not null,
  team text not null,
  role public.ws_role not null,
  last_active interval not null
);

insert into demo_people (local, email, name, title, color, team, role, last_active)
select v.local, coalesce(v.email, (select email from demo_auth)), v.name, v.title, v.color, v.team,
       v.role::public.ws_role, v.last_active
from (values
  ('me',          null,                           '데모 사용자', '프로젝트 매니저',     'indigo', '제품',   'admin',  interval '1 minute'),
  ('hana.song',   'hana.song@demo.example.com',   '송하나',     '대표',               'violet', '제품',   'owner',  interval '20 minutes'),
  ('woojin.bae',  'woojin.bae@demo.example.com',  '배우진',     '프론트엔드 엔지니어', 'blue',   '개발',   'member', interval '10 minutes'),
  ('eunji.seo',   'eunji.seo@demo.example.com',   '서은지',     'UX 디자이너',        'rose',   '디자인', 'member', interval '1 hour'),
  ('hyunwoo.nam', 'hyunwoo.nam@demo.example.com', '남현우',     '백엔드 엔지니어',    'teal',   '개발',   'member', interval '3 hours'),
  ('yerin.kwon',  'yerin.kwon@demo.example.com',  '권예린',     '마케터',             'amber',  '마케팅', 'member', interval '1 day')
) v(local, email, name, title, color, team, role, last_active);

-- 지울 데모 워크스페이스. demo_seed 계정이 구성원인 워크스페이스이고, 다른 구성원이 섞여 있으면 아래 가드가 멈춘다.
create temp table demo_old_ws as
select w.id from public.workspaces w
where exists (
  select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = w.id and u.raw_app_meta_data ->> 'demo_seed' = 'true'
);

do $$
begin
  -- 데모가 아닌 기존 계정과 주소가 겹치면 그 계정을 지우거나 바꾸지 않도록 멈춘다.
  if exists (
    select 1 from auth.users u join demo_people dp on lower(u.email) = dp.email
    where coalesce(u.raw_app_meta_data ->> 'demo_seed', '') <> 'true'
  ) then
    raise exception 'DEMO_EMAIL 또는 데모 구성원 주소가 데모가 아닌 기존 계정과 같다. 다른 주소를 쓴다.';
  end if;
  -- 데모 계정이 데모 워크스페이스 밖(데모가 아닌 구성원이 있는 워크스페이스)의 구성원이면 그 워크스페이스를 건드리지 않고 멈춘다.
  if exists (
    select 1 from demo_old_ws d
    join public.workspace_members m on m.workspace_id = d.id
    join auth.users u on u.id = m.user_id
    where coalesce(u.raw_app_meta_data ->> 'demo_seed', '') <> 'true'
  ) then
    raise exception '데모 계정이 데모가 아닌 구성원이 있는 워크스페이스에 들어가 있다. 지우지 않고 멈춘다.';
  end if;
  -- 사람이 만든 워크스페이스가 slug demo를 쓰고 있으면 지우지 않고 멈춘다.
  if exists (select 1 from public.workspaces w where w.slug = 'demo' and w.id not in (select id from demo_old_ws)) then
    raise exception 'slug demo를 데모가 아닌 워크스페이스가 쓰고 있다. 지우지 않고 멈춘다.';
  end if;
  -- db-demo.sh가 Storage 객체를 먼저 지운다. 남아 있으면 행을 지워 고아를 만들지 않도록 멈춘다.
  if exists (
    select 1 from storage.objects o join demo_old_ws d on o.name like d.id::text || '/%'
    where o.bucket_id = 'files'
  ) then
    raise exception '데모 워크스페이스의 Storage 객체가 남아 있다. 다시 실행한다.';
  end if;
end;
$$;

create function pg_temp.u(p_local text) returns uuid language sql stable as $$
  select u.id from auth.users u join demo_people dp on lower(u.email) = dp.email where dp.local = p_local;
$$;

create function pg_temp.ws() returns uuid language sql stable as $$
  select id from public.workspaces where slug = 'demo';
$$;

create function pg_temp.p(p_key text) returns uuid language sql stable as $$
  select id from public.projects where workspace_id = pg_temp.ws() and key = p_key;
$$;

create function pg_temp.t(p_key text) returns uuid language sql stable as $$
  select id from public.tasks where workspace_id = pg_temp.ws() and key = p_key;
$$;

-- ─────────────────────────────────────────────
-- 초기화. 워크스페이스를 먼저 지워 하위 행을 cascade로 정리하고, 그다음 데모 계정을 지운다.
-- 계정 삭제가 profiles·세션·즐겨찾기·설정까지 cascade하므로 데모에서 바꾼 프로필도 처음으로 돌아간다.
-- Storage 객체는 SQL로 지울 수 없어 db-demo.sh가 이 트랜잭션 전에 Storage API로 지운다.
-- ─────────────────────────────────────────────
delete from public.workspaces where id in (select id from demo_old_ws);
delete from auth.users where raw_app_meta_data ->> 'demo_seed' = 'true';

-- ─────────────────────────────────────────────
-- 인증 사용자. on_auth_user_created 트리거가 profiles를 만든다.
-- ─────────────────────────────────────────────
-- GoTrue는 토큰 컬럼이 null이면 로그인 조회에서 실패하므로 빈 문자열로 채운다.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, banned_until
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  dp.email,
  extensions.crypt(case when dp.local = 'me' then (select pw from demo_auth) else gen_random_uuid()::text end,
                   extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"demo_seed":true}'::jsonb, jsonb_build_object('name', dp.name),
  now() - interval '30 days', now() - interval '30 days',
  '', '', '', '',
  -- 데모 계정 외 구성원은 막는다. GoTrue가 로그인·재설정 링크 확인을 user_banned로 거부한다
  case when dp.local <> 'me' then timestamptz '2999-12-31' end
from demo_people dp;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), u.created_at, u.created_at
from auth.users u
join demo_people dp on lower(u.email) = dp.email;

update public.profiles pf set color = dp.color
from demo_people dp
where pf.id = pg_temp.u(dp.local);

-- 자격 표는 더 쓰지 않는다.
drop table demo_auth;

-- ─────────────────────────────────────────────
-- 워크스페이스·팀·구성원
-- ─────────────────────────────────────────────
insert into public.workspaces (name, slug, color, team_size, created_by)
values ('데모 스튜디오', 'demo', 'violet', '2-10', pg_temp.u('hana.song'));

insert into public.teams (workspace_id, name, icon, color, description) values
  (pg_temp.ws(), '제품',   'target',    'indigo', '제품 방향과 일정을 맡는다.'),
  (pg_temp.ws(), '디자인', 'palette',   'violet', '앱 화면과 브랜드 디자인을 맡는다.'),
  (pg_temp.ws(), '개발',   'code',      'blue',   '앱·서버 개발을 맡는다.'),
  (pg_temp.ws(), '마케팅', 'megaphone', 'amber',  '캠페인과 콘텐츠를 맡는다.');

insert into public.workspace_members (workspace_id, user_id, role, status, title, color, team_id, last_active_at)
select pg_temp.ws(), pg_temp.u(dp.local), dp.role, 'active', dp.title, dp.color, tm.id, now() - dp.last_active
from demo_people dp
join public.teams tm on tm.workspace_id = pg_temp.ws() and tm.name = dp.team;

-- ─────────────────────────────────────────────
-- 프로젝트 3. seq는 기본값 200(시드 키 최대 136보다 크다)이라 새 작업은 201부터 나온다.
-- ─────────────────────────────────────────────
insert into public.projects (workspace_id, key, name, icon, color, status, team_id, lead_id, start_date, due_date, description, access, created_by, created_at)
select pg_temp.ws(), v.key, v.name, v.icon, v.color, v.status::public.project_status,
       (select tm.id from public.teams tm where tm.workspace_id = pg_temp.ws() and tm.name = v.team),
       pg_temp.u(v.lead), current_date + v.s, current_date + v.d, v.descr, 'workspace',
       pg_temp.u(v.lead), now() - make_interval(days => v.age)
from (values
  ('APP', '모바일 앱 리뉴얼', 'smartphone', 'blue',  'active',   '개발',   'woojin.bae', -21, 24, '앱 첫 화면과 결제 흐름을 새로 만든다.',          25),
  ('BRD', '브랜드 캠페인',    'megaphone',  'amber', 'planning', '마케팅', 'yerin.kwon', -7,  30, '연말 브랜드 캠페인을 준비한다.',                10),
  ('OPS', '고객 지원 개선',   'target',     'rose',  'risk',     '제품',   'me',         -14, 10, '문의 응답 시간을 줄이고 도움말을 정리한다.',     18)
) v(key, name, icon, color, status, team, lead, s, d, descr, age);

-- 생성 경로(create_project)처럼 리드를 full 구성원으로 넣는다.
insert into public.project_members (project_id, user_id, perm)
select pr.id, pr.lead_id, 'full'
from public.projects pr
where pr.workspace_id = pg_temp.ws();

insert into public.milestones (project_id, name, date)
select pg_temp.p(v.key), v.name, current_date + v.d
from (values
  ('APP', '디자인 확정',   -2),
  ('APP', '베타 배포',     12),
  ('APP', '스토어 출시',   24),
  ('BRD', '캠페인 런칭',   30),
  ('OPS', '도움말 공개',   10)
) v(key, name, d);

-- ─────────────────────────────────────────────
-- 작업 27. 키는 {KEY}-{100+3n}. postgres로 key를 넣으면 assign_task_key 트리거가 그대로 둔다.
-- s·d는 오늘 기준 시작·마감 일수, done_ago는 완료 시점(일 전)
-- ─────────────────────────────────────────────
insert into public.tasks (
  workspace_id, project_id, key, title, status, priority, assignee_id, start_date, due_date,
  labels, estimate, recur, sort_order, completed_at, created_by, created_at
)
select
  pr.workspace_id, pr.id, v.pkey || '-' || (100 + 3 * v.n), v.title,
  v.status::public.task_status, v.priority::public.task_priority, pg_temp.u(v.who),
  current_date + v.s, current_date + v.d, v.labels::text[], v.est, v.recur::public.repeat_kind,
  1000 * row_number() over (partition by v.pkey, v.status order by v.n),
  case when v.status = 'done' then now() - make_interval(days => v.done_ago) end,
  pr.lead_id,
  now() - make_interval(days => greatest(coalesce(-v.s, 0), coalesce(-v.d, 0), coalesce(v.done_ago, 0)) + 2 + v.n % 3)
from (values
  -- 모바일 앱 리뉴얼 12
  ('APP', 0,  '첫 화면 와이어프레임 확정',     'done',     'high',   'eunji.seo',   -18, -12,  '{design}',            null,  'none',   11),
  ('APP', 1,  '로그인 화면 구현',              'progress', 'high',   'woojin.bae',  -4,   1,    '{frontend}',          '2d',  'none',   null),
  ('APP', 2,  '결제 API 연동',                 'progress', 'urgent', 'hyunwoo.nam', -6,   -1,   '{backend}',           '3d',  'none',   null),
  ('APP', 3,  '결제 화면 디자인 검토',         'review',   'high',   'eunji.seo',   -3,   0,    '{design}',            '4h',  'none',   null),
  ('APP', 4,  '푸시 알림 설정 화면',           'todo',     'medium', 'woojin.bae',  2,    6,    '{frontend}',          '1d',  'none',   null),
  ('APP', 5,  '앱 비정상 종료 수정',           'todo',     'urgent', 'hyunwoo.nam', null, 0,    '{bug,backend}',       '4h',  'none',   null),
  ('APP', 6,  '접근성 점검',                   'todo',     'high',   'me',          3,    8,    '{qa}',                null,  'none',   null),
  ('APP', 7,  '다크 모드 색상 정리',           'backlog',  'low',    'eunji.seo',   null, null, '{design}',            null,  'none',   null),
  ('APP', 8,  '오프라인 모드 리서치',          'backlog',  'medium', 'me',          null, 15,   '{research}',          null,  'none',   null),
  ('APP', 9,  '주간 스프린트 회의',            'todo',     'medium', 'me',          null, 2,    '{}',                  '1h',  'weekly', null),
  ('APP', 10, '아이콘 세트 교체',              'done',     'medium', 'eunji.seo',   -10,  -5,   '{design,frontend}',   null,  'none',   4),
  ('APP', 11, '베타 테스터 모집 공지',         'review',   'medium', 'yerin.kwon',  -2,   3,    '{content,growth}',    null,  'none',   null),
  -- 브랜드 캠페인 8
  ('BRD', 0,  '캠페인 목표와 KPI 정리',        'done',     'high',   'me',          -7,   -3,   '{growth}',            null,  'none',   2),
  ('BRD', 1,  '타깃 고객 인터뷰',              'progress', 'medium', 'yerin.kwon',  -3,   4,    '{research}',          null,  'none',   null),
  ('BRD', 2,  '키 비주얼 시안',                'todo',     'high',   'eunji.seo',   1,    9,    '{design}',            '2d',  'none',   null),
  ('BRD', 3,  'SNS 광고 문구 작성',            'todo',     'medium', 'yerin.kwon',  null, 7,    '{content}',           null,  'none',   null),
  ('BRD', 4,  '랜딩 페이지 제작',              'backlog',  'medium', 'woojin.bae',  10,   20,   '{frontend,growth}',   '3d',  'none',   null),
  ('BRD', 5,  '채널별 예산 배분',              'backlog',  'low',    'hana.song',   null, null, '{growth}',            null,  'none',   null),
  ('BRD', 6,  '협업 크리에이터 후보 조사',     'todo',     'low',    'yerin.kwon',  2,    12,   '{research}',          null,  'none',   null),
  ('BRD', 7,  '캠페인 성과 리포트 양식',       'backlog',  'none',   null,          null, 28,   '{content}',           null,  'none',   null),
  -- 고객 지원 개선 7
  ('OPS', 0,  '문의 유형 분류',                'done',     'medium', 'me',          -12,  -8,   '{research}',          null,  'none',   7),
  ('OPS', 1,  '자주 묻는 질문 정리',           'progress', 'high',   'yerin.kwon',  -5,   2,    '{content}',           null,  'none',   null),
  ('OPS', 2,  '응답 템플릿 작성',              'review',   'medium', 'me',          -4,   -1,   '{content}',           '4h',  'none',   null),
  ('OPS', 3,  '문의 접수 폼 오류 수정',        'progress', 'urgent', 'hyunwoo.nam', -2,   -2,   '{bug,backend}',       '2h',  'none',   null),
  ('OPS', 4,  '도움말 페이지 디자인',          'todo',     'medium', 'eunji.seo',   1,    5,    '{design}',            null,  'none',   null),
  ('OPS', 5,  '일일 문의 현황 확인',           'todo',     'low',    'me',          null, 0,    '{qa}',                '30m', 'daily',  null),
  ('OPS', 6,  '지원 도구 비교 검토',           'backlog',  'medium', 'hana.song',   null, null, '{research}',          null,  'none',   null)
) v(pkey, n, title, status, priority, who, s, d, labels, est, recur, done_ago)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

insert into public.subtasks (task_id, title, done, assignee_id, sort_order)
select pg_temp.t(v.key), v.title, v.done, pg_temp.u(v.who), v.n * 1000
from (values
  ('APP-103', 1, '이메일 입력 검증',          true,  'woojin.bae'),
  ('APP-103', 2, '오류 문구 적용',            false, 'woojin.bae'),
  ('APP-103', 3, '키보드 탐색 확인',          false, 'me'),
  ('APP-106', 1, '결제 대행사 키 발급',       true,  'hyunwoo.nam'),
  ('APP-106', 2, '승인·취소 API 연결',        false, 'hyunwoo.nam'),
  ('APP-106', 3, '실패 재시도 처리',          false, null),
  ('BRD-103', 1, '인터뷰 질문지 작성',        true,  'yerin.kwon'),
  ('BRD-103', 2, '참가자 5명 섭외',           false, 'yerin.kwon'),
  ('OPS-103', 1, '상위 20개 질문 추리기',     true,  'yerin.kwon'),
  ('OPS-103', 2, '답변 초안 검토',            false, 'me')
) v(key, n, title, done, who);

-- (작업, 이 작업을 막는 작업). 모두 같은 프로젝트 안이다.
insert into public.task_deps (task_id, blocked_by_id)
select pg_temp.t(v.task), pg_temp.t(v.blocker)
from (values
  ('APP-109', 'APP-106'),
  ('APP-112', 'APP-103'),
  ('BRD-106', 'BRD-103'),
  ('OPS-112', 'OPS-103')
) v(task, blocker);

-- ─────────────────────────────────────────────
-- 댓글·반응
-- ─────────────────────────────────────────────
insert into public.comments (task_id, author_id, body, created_at, updated_at)
select pg_temp.t(v.key), pg_temp.u(v.who), v.body, now() - v.ago, now() - v.ago
from (values
  ('APP-106', 'hyunwoo.nam', '승인 API는 연결했고 취소 API를 붙이는 중입니다.',              interval '40 minutes'),
  ('APP-106', 'me',          '마감이 지났어요. 오늘 안에 범위를 다시 정해 볼까요?',          interval '20 minutes'),
  ('APP-109', 'eunji.seo',   '결제 완료 화면 시안을 두 가지로 올려 두었어요.',               interval '2 hours'),
  ('APP-109', 'woojin.bae',  'B안이 구현하기 더 쉬워 보입니다.',                             interval '1 hour'),
  ('BRD-100', 'hana.song',   'KPI 목표치 좋습니다. 이대로 진행하죠.',                        interval '2 days'),
  ('OPS-106', 'me',          '템플릿 다섯 개 초안 작성했습니다. 검토 부탁드려요.',           interval '5 hours'),
  ('OPS-106', 'hana.song',   '두 번째 템플릿은 조금 더 짧게 다듬어 주세요.',                 interval '1 hour'),
  ('OPS-109', 'hyunwoo.nam', '첨부 파일이 크면 접수가 실패하는 문제를 찾았습니다.',          interval '3 hours'),
  ('APP-118', 'woojin.bae',  '스크린 리더 점검 목록을 공유해 주세요.',                        interval '30 minutes')
) v(key, who, body, ago);

insert into public.comment_reactions (comment_id, user_id, emoji)
select c.id, pg_temp.u(v.who), v.emoji
from (values
  ('B안이 구현하기 더 쉬워 보입니다.',                    'eunji.seo', '👍'),
  ('KPI 목표치 좋습니다. 이대로 진행하죠.',               'me',        '🎉'),
  ('첨부 파일이 크면 접수가 실패하는 문제를 찾았습니다.', 'me',        '👀')
) v(body, who, emoji)
join public.comments c on c.body = v.body
join public.tasks t on t.id = c.task_id and t.workspace_id = pg_temp.ws();

-- ─────────────────────────────────────────────
-- 활동. extra는 rpc 마이그레이션의 활동 트리거가 verb별로 넣는 형식을 그대로 따른다.
-- ─────────────────────────────────────────────
insert into public.activities (workspace_id, project_id, task_id, actor_id, verb, extra, created_at)
select pr.workspace_id, pr.id, pg_temp.t(v.task), pg_temp.u(v.who), v.verb, v.extra, now() - v.ago
from (values
  ('APP', 'APP-109', 'eunji.seo',   'moved',               jsonb_build_object('from', 'progress', 'to', 'review'), interval '2 hours'),
  ('APP', 'APP-130', 'eunji.seo',   'completed',           jsonb_build_object('from', 'review', 'to', 'done'),     interval '4 days'),
  ('APP', 'APP-106', 'hyunwoo.nam', 'changed priority of', jsonb_build_object('from', 'high', 'to', 'urgent'),     interval '1 day'),
  ('APP', 'APP-118', 'hana.song',   'assigned',            jsonb_build_object('from', null, 'to', pg_temp.u('me')), interval '1 day'),
  ('BRD', null,      'yerin.kwon',  'created project',     '{}'::jsonb,                                             interval '10 days'),
  ('OPS', null,      'me',          'changed status of project', jsonb_build_object('from', 'active', 'to', 'risk'), interval '1 day')
) v(pkey, task, who, verb, extra, ago)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

-- ─────────────────────────────────────────────
-- 알림 6. 수신자는 모두 데모 사용자. read_at이 있으면 읽음
-- 문구·발췌는 서버 트리거와 같다. 작업 알림은 같은 프로젝트를 함께 넣는다(복합 FK).
-- ─────────────────────────────────────────────
insert into public.notifications (user_id, workspace_id, type, actor_id, task_id, project_id, text, snippet, read_at, created_at)
select pg_temp.u('me'), pg_temp.ws(), v.type::public.notification_type, pg_temp.u(v.who),
       pg_temp.t(v.task), pg_temp.p(v.pkey), v.text, v.snippet,
       case when v.is_read then now() - v.ago + interval '10 minutes' end, now() - v.ago
from (values
  ('assign',  'hana.song',   'APP-118', 'APP', '회원님을 담당자로 지정했습니다',    null,                                                false, interval '1 day'),
  ('comment', 'hana.song',   'OPS-106', 'OPS', '회원님의 작업에 댓글을 남겼습니다', '두 번째 템플릿은 조금 더 짧게 다듬어 주세요.',        false, interval '1 hour'),
  ('comment', 'hana.song',   'BRD-100', 'BRD', '회원님의 작업에 댓글을 남겼습니다', 'KPI 목표치 좋습니다. 이대로 진행하죠.',               true,  interval '2 days'),
  ('assign',  'woojin.bae',  'APP-127', 'APP', '회원님을 담당자로 지정했습니다',    null,                                                false, interval '5 hours'),
  ('assign',  'hana.song',   'OPS-106', 'OPS', '회원님을 담당자로 지정했습니다',    null,                                                true,  interval '4 days'),
  ('comment', 'woojin.bae',  'APP-118', 'APP', '회원님의 작업에 댓글을 남겼습니다', '스크린 리더 점검 목록을 공유해 주세요.',              false, interval '30 minutes')
) v(type, who, task, pkey, text, snippet, is_read, ago);

-- ─────────────────────────────────────────────
-- 일정 5·저장 뷰 1·즐겨찾기
-- ─────────────────────────────────────────────
insert into public.events (workspace_id, project_id, title, date, time, created_by)
select pr.workspace_id, pr.id, v.title, current_date + v.d, v.t::time, pg_temp.u(v.who)
from (values
  ('APP', '결제 흐름 점검 회의', 0,  '14:00', 'me'),
  ('APP', '스프린트 계획',       2,  '10:00', 'woojin.bae'),
  ('BRD', '캠페인 킥오프',       5,  '15:00', 'yerin.kwon'),
  ('OPS', '지원팀 회고',         8,  null,    'me'),
  ('APP', '베타 배포',           12, null,    'hana.song')
) v(pkey, title, d, t, who)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

insert into public.saved_views (workspace_id, project_id, name, type, filters, created_by)
values (pg_temp.ws(), pg_temp.p('APP'), '긴급·높음', 'list',
        '[{"f":"priority","op":"is","v":["urgent","high"]}]', pg_temp.u('me'));

insert into public.favorites (user_id, workspace_id, project_id) values
  (pg_temp.u('me'), pg_temp.ws(), pg_temp.p('APP')),
  (pg_temp.u('me'), pg_temp.ws(), pg_temp.p('OPS'));
