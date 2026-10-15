-- 로컬 개발·테스트 전용 시드. 워크스페이스 3개와 META §4 개수의 업무 데이터를 넣는다.
--
-- 경고. 로컬 Supabase 스택 전용이다. 운영·원격 DB에 실행하지 않는다.
-- 직접 실행하지 말고 scripts/db-seed.sh로 넣는다(로컬 대상 확인, 중복 확인, 한 트랜잭션, Storage 파일 업로드).
-- config.toml의 자동 시드는 꺼져 있고 이 파일은 db reset 때 자동으로 실행되지 않는다.
-- 모든 날짜는 실행 시점 기준 상대값(current_date + n, now() - interval)이다.
-- files 행은 pending으로 들어가고 scripts/seed-files.mjs가 실제 업로드에 성공한 행만 ready로 바꾼다.
--
-- 로그인 계정. 공통 비밀번호는 seed-pass-2026 이다.
--   jiyoon.kim@example.com    김지윤  제품 총괄         hanbit owner, dalbit member
--   seojun.park@example.com   박서준  디자인 리드       hanbit admin
--   dohyun.lee@example.com    이도현  프론트엔드 엔지니어 hanbit member
--   haeun.choi@example.com    최하은  프로덕트 디자이너  hanbit member
--   minjae.jung@example.com   정민재  콘텐츠 전략가     hanbit member
--   taeo.kang@example.com     강태오  백엔드 엔지니어   hanbit member
--   sora.yoon@example.com     윤소라  QA 리드          hanbit admin
--   yujin.han@example.com     한유진  프리랜스 카피라이터 hanbit guest(invited)
--   serin.oh@example.com      오세린  dalbit owner
--   jaewon.lim@example.com    임재원  byeol owner

set client_encoding = 'UTF8';

-- ─────────────────────────────────────────────
-- 조회 헬퍼(이 세션에서만 존재)
-- ─────────────────────────────────────────────
create temp table seed_people (
  local text primary key,
  name text not null,
  title text,
  color text not null,
  team text,
  role public.ws_role,
  status public.member_status,
  last_active interval
);

insert into seed_people (local, name, title, color, team, role, status, last_active) values
  ('jiyoon.kim',  '김지윤', '제품 총괄',          'indigo', '제품',     'owner',  'active',  interval '2 minutes'),
  ('seojun.park', '박서준', '디자인 리드',        'violet', '디자인',   'admin',  'active',  interval '15 minutes'),
  ('dohyun.lee',  '이도현', '프론트엔드 엔지니어', 'blue',   '엔지니어링', 'member', 'active',  interval '1 hour'),
  ('haeun.choi',  '최하은', '프로덕트 디자이너',   'rose',   '디자인',   'member', 'active',  interval '5 minutes'),
  ('minjae.jung', '정민재', '콘텐츠 전략가',      'amber',  '마케팅',   'member', 'active',  interval '3 hours'),
  ('taeo.kang',   '강태오', '백엔드 엔지니어',    'teal',   '엔지니어링', 'member', 'active',  interval '1 day'),
  ('sora.yoon',   '윤소라', 'QA 리드',           'green',  '엔지니어링', 'admin',  'active',  interval '30 minutes'),
  ('yujin.han',   '한유진', '프리랜스 카피라이터', 'slate',  '마케팅',   'guest',  'invited', null),
  -- 다른 워크스페이스 소유자. hanbit 구성원이 아니다.
  ('serin.oh',    '오세린', null,                'teal',   null,       null,     null,      null),
  ('jaewon.lim',  '임재원', null,                'rose',   null,       null,     null,      null);

create function pg_temp.u(p_local text) returns uuid language sql stable as $$
  select id from auth.users where email = p_local || '@example.com';
$$;

create function pg_temp.ws(p_slug text) returns uuid language sql stable as $$
  select id from public.workspaces where slug = p_slug;
$$;

-- 시드 프로젝트 키는 세 워크스페이스를 통틀어 겹치지 않게 만든다.
create function pg_temp.p(p_key text) returns uuid language sql stable as $$
  select pr.id from public.projects pr
  join public.workspaces w on w.id = pr.workspace_id
  where w.slug in ('hanbit', 'dalbit', 'byeol') and pr.key = p_key;
$$;

create function pg_temp.t(p_key text) returns uuid language sql stable as $$
  select t.id from public.tasks t
  join public.workspaces w on w.id = t.workspace_id
  where w.slug in ('hanbit', 'dalbit', 'byeol') and t.key = p_key;
$$;

-- ─────────────────────────────────────────────
-- 인증 사용자. on_auth_user_created 트리거가 profiles를 만든다.
-- ─────────────────────────────────────────────
-- GoTrue는 토큰 컬럼이 null이면 로그인 조회에서 실패하므로 빈 문자열로 채운다.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  sp.local || '@example.com', extensions.crypt('seed-pass-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', sp.name),
  now() - interval '60 days', now() - interval '60 days',
  '', '', '', ''
from seed_people sp;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), u.created_at, u.created_at
from auth.users u
join seed_people sp on u.email = sp.local || '@example.com';

update public.profiles pf set color = sp.color
from seed_people sp
where pf.id = pg_temp.u(sp.local);

-- ─────────────────────────────────────────────
-- 워크스페이스·팀·구성원
-- ─────────────────────────────────────────────
insert into public.workspaces (name, slug, color, team_size, created_by) values
  ('한빛 스튜디오', 'hanbit', 'indigo', '2-10', pg_temp.u('jiyoon.kim')),
  ('달빛 랩스',     'dalbit', 'teal',   '2-10', pg_temp.u('serin.oh')),
  ('별빛 커머스',   'byeol',  'rose',   'solo', pg_temp.u('jaewon.lim'));

insert into public.teams (workspace_id, name, icon, color, description) values
  (pg_temp.ws('hanbit'), '디자인',     'palette',   'violet', '브랜드와 제품 화면 디자인을 맡는다.'),
  (pg_temp.ws('hanbit'), '엔지니어링', 'code',      'blue',   '웹·앱·서버 개발과 품질 검증을 맡는다.'),
  (pg_temp.ws('hanbit'), '마케팅',     'megaphone', 'amber',  '캠페인과 콘텐츠를 맡는다.'),
  (pg_temp.ws('hanbit'), '제품',       'target',    'indigo', '제품 방향과 출시 일정을 맡는다.');

insert into public.workspace_members (workspace_id, user_id, role, status, title, color, team_id, last_active_at)
select pg_temp.ws('hanbit'), pg_temp.u(sp.local), sp.role, sp.status, sp.title, sp.color, tm.id,
       now() - sp.last_active
from seed_people sp
left join public.teams tm on tm.workspace_id = pg_temp.ws('hanbit') and tm.name = sp.team
where sp.role is not null;

insert into public.workspace_members (workspace_id, user_id, role, status, title, color, last_active_at) values
  (pg_temp.ws('dalbit'), pg_temp.u('serin.oh'),   'owner',  'active', '리서치 리드', 'teal',   now() - interval '20 minutes'),
  -- 워크스페이스 전환 확인용. 세 번째(byeol)에는 넣지 않는다(격리 확인용).
  (pg_temp.ws('dalbit'), pg_temp.u('jiyoon.kim'), 'member', 'active', '자문',       'indigo', now() - interval '2 days'),
  (pg_temp.ws('byeol'),  pg_temp.u('jaewon.lim'), 'owner',  'active', '대표',       'rose',   now() - interval '1 hour');

-- ─────────────────────────────────────────────
-- 프로젝트. seq는 기본값 200(시드 키 최대 151보다 크다)이라 새 작업은 201부터 나온다.
-- ─────────────────────────────────────────────
insert into public.projects (workspace_id, key, name, icon, color, status, team_id, lead_id, start_date, due_date, description, access, created_by, created_at)
select pg_temp.ws(v.ws), v.key, v.name, v.icon, v.color, v.status::public.project_status,
       (select tm.id from public.teams tm where tm.workspace_id = pg_temp.ws(v.ws) and tm.name = v.team),
       pg_temp.u(v.lead), current_date + v.s, current_date + v.d, v.descr, v.access::public.project_access,
       pg_temp.u(v.lead), now() - make_interval(days => v.age)
from (values
  ('hanbit', 'WEB', '웹사이트 리디자인', 'globe',       'indigo', 'active',   '디자인',     'seojun.park', -30, 21, '회사 웹사이트의 구조와 디자인을 새로 정리한다.', 'workspace', 35),
  ('hanbit', 'MOB', '모바일 앱',         'smartphone',  'blue',   'active',   '엔지니어링', 'dohyun.lee',  -20, 30, 'iOS·Android 앱 1.0을 출시한다.',              'workspace', 25),
  ('hanbit', 'MKT', '마케팅 캠페인',     'megaphone',   'amber',  'planning', '마케팅',     'minjae.jung', -5,  20, '가을 신규 고객 유치 캠페인을 준비한다.',       'workspace', 14),
  ('hanbit', 'LCH', '제품 출시',         'rocket',      'rose',   'risk',     '제품',       'jiyoon.kim',  -25, 14, '신규 요금제와 결제 기능을 출시한다.',          'workspace', 30),
  ('hanbit', 'DS',  '디자인 시스템',     'component',   'violet', 'active',   '디자인',     'haeun.choi',  -40, 18, '공통 컴포넌트와 토큰을 정리해 문서화한다.',    'workspace', 45),
  ('hanbit', 'CP',  '고객 포털',         'building-2',  'teal',   'hold',     '엔지니어링', 'taeo.kang',   -60, 60, '기업 고객용 포털. 요구사항 재검토로 보류 중이다.', 'private', 70),
  ('hanbit', 'MW',  '마케팅 웹사이트',   'layout-grid', 'green',  'complete', '마케팅',     'minjae.jung', -60, -30, '캠페인 랜딩 페이지. 배포를 마쳤다.',          'workspace', 65),
  ('dalbit', 'EXP', '실험 대시보드',     'layers',      'teal',   'active',   null,         'serin.oh',    -10, 20, 'A/B 실험 결과를 한 화면에서 본다.',           'workspace', 12),
  ('byeol',  'SHOP', '쇼핑몰 오픈 준비', 'briefcase',   'rose',   'planning', null,         'jaewon.lim',  -3,  40, '온라인 쇼핑몰 1차 오픈을 준비한다.',          'workspace', 5)
) v(ws, key, name, icon, color, status, team, lead, s, d, descr, access, age);

-- 생성 경로(create_project)처럼 리드를 full 구성원으로 넣는다.
insert into public.project_members (project_id, user_id, perm)
select pr.id, pr.lead_id, 'full'
from public.projects pr
where pr.workspace_id in (pg_temp.ws('hanbit'), pg_temp.ws('dalbit'), pg_temp.ws('byeol'));

insert into public.project_members (project_id, user_id, perm) values
  -- 비공개 고객 포털은 리드(강태오) 외에 이도현만 초대한다.
  (pg_temp.p('CP'),  pg_temp.u('dohyun.lee'), 'edit'),
  -- 게스트 카피라이터는 마케팅 캠페인에서 댓글까지만
  (pg_temp.p('MKT'), pg_temp.u('yujin.han'),  'comment');

insert into public.milestones (project_id, name, date)
select pg_temp.p(v.key), v.name, current_date + v.d
from (values
  ('WEB', '디자인 확정',   -3),
  ('WEB', '베타 오픈',     10),
  ('WEB', '정식 오픈',     21),
  ('MOB', '베타 테스트',   12),
  ('MOB', '스토어 출시',   30),
  ('MKT', '캠페인 런칭',   20),
  ('LCH', '코드 프리즈',   5),
  ('LCH', '출시일',        14),
  ('DS',  'v1.0 공개',     18),
  ('CP',  '요구사항 확정', 45),
  ('MW',  '오픈 완료',     -30),
  ('EXP', '첫 실험 공개',  14),
  ('SHOP', '1차 오픈',     40)
) v(key, name, d);

-- ─────────────────────────────────────────────
-- 작업. 키는 {KEY}-{100+3n}. postgres로 key를 넣으면 assign_task_key 트리거가 그대로 둔다.
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
  -- 웹사이트 리디자인 18
  ('WEB', 0,  '홈페이지 히어로 섹션 시안 확정',   'review',   'high',   'haeun.choi',  -6,   0,    '{design}',             '1d',  'none',   null),
  ('WEB', 1,  '내비게이션 반응형 레이아웃 구현',  'progress', 'high',   'dohyun.lee',  -4,   0,    '{frontend}',           '2d',  'none',   null),
  ('WEB', 2,  '가격 페이지 카피 정리',            'todo',     'medium', 'minjae.jung', -2,   1,    '{content}',            null,  'none',   null),
  ('WEB', 3,  '문의 폼 서버 검증 추가',           'progress', 'urgent', 'taeo.kang',   -5,   -2,   '{backend}',            '4h',  'none',   null),
  ('WEB', 4,  '사이트맵과 URL 구조 확정',         'done',     'medium', 'jiyoon.kim',  -20,  -12,  '{research}',           null,  'none',   11),
  ('WEB', 5,  '이미지 지연 로딩 적용',            'todo',     'medium', 'dohyun.lee',  1,    4,    '{frontend}',           '2h',  'none',   null),
  ('WEB', 6,  '색 대비 접근성 점검',              'todo',     'high',   'sora.yoon',   2,    5,    '{qa}',                 null,  'none',   null),
  ('WEB', 7,  '블로그 목록 페이지 디자인',        'backlog',  'low',    'haeun.choi',  null, null, '{design}',             null,  'none',   null),
  ('WEB', 8,  '404 페이지 문구 작성',             'backlog',  'none',   'minjae.jung', null, null, '{content}',            null,  'none',   null),
  ('WEB', 9,  '분석 태그 설치',                   'review',   'medium', 'taeo.kang',   -3,   -1,   '{growth,backend}',     null,  'none',   null),
  ('WEB', 10, '푸터 링크 정리',                   'done',     'low',    'dohyun.lee',  -8,   -4,   '{frontend}',           '30m', 'none',   3),
  ('WEB', 11, '주간 디자인 리뷰',                 'todo',     'medium', 'jiyoon.kim',  null, 2,    '{design}',             '1h',  'weekly', null),
  ('WEB', 12, '고객 사례 섹션 콘텐츠 수집',       'progress', 'medium', 'minjae.jung', -1,   6,    '{content,research}',   null,  'none',   null),
  ('WEB', 13, '모바일 메뉴 겹침 버그 수정',       'todo',     'urgent', 'dohyun.lee',  null, 0,    '{bug,frontend}',       '30m', 'none',   null),
  ('WEB', 14, '크로스 브라우저 테스트',           'backlog',  'medium', 'sora.yoon',   7,    12,   '{qa}',                 '3d',  'none',   null),
  ('WEB', 15, '검색 엔진 메타데이터 정리',        'backlog',  'low',    null,          null, 14,   '{growth}',             null,  'none',   null),
  ('WEB', 16, '오픈 전 성능 측정',                'todo',     'high',   'taeo.kang',   5,    9,    '{backend,qa}',         '1d',  'none',   null),
  ('WEB', 17, '브랜드 컬러 토큰 반영',            'done',     'medium', 'haeun.choi',  -10,  -6,   '{design,frontend}',    null,  'none',   1),
  -- 모바일 앱 9
  ('MOB', 0,  '온보딩 화면 흐름 설계',            'done',     'high',   'haeun.choi',  -14,  -7,   '{design}',             null,  'none',   6),
  ('MOB', 1,  '푸시 알림 권한 요청 구현',         'progress', 'high',   'dohyun.lee',  -3,   3,    '{frontend}',           '2d',  'none',   null),
  ('MOB', 2,  '로그인 토큰 갱신 API',             'review',   'urgent', 'taeo.kang',   -6,   -1,   '{backend}',            '1d',  'none',   null),
  ('MOB', 3,  '오프라인 모드 리서치',             'todo',     'medium', 'jiyoon.kim',  null, 5,    '{research}',           null,  'none',   null),
  ('MOB', 4,  '다크 모드 아이콘 정리',            'backlog',  'low',    'haeun.choi',  null, null, '{design}',             null,  'none',   null),
  ('MOB', 5,  '앱 비정상 종료 리포트 분석',       'todo',     'high',   'sora.yoon',   0,    2,    '{bug,qa}',             '4h',  'none',   null),
  ('MOB', 6,  '스토어 스크린샷 제작',             'backlog',  'medium', 'minjae.jung', 8,    15,   '{content,design}',     null,  'none',   null),
  ('MOB', 7,  '일일 빌드 상태 확인',              'todo',     'medium', 'sora.yoon',   null, 0,    '{qa}',                 '30m', 'daily',  null),
  ('MOB', 8,  '결제 화면 QA',                     'progress', 'high',   'sora.yoon',   -2,   1,    '{qa}',                 null,  'none',   null),
  -- 마케팅 캠페인 7
  ('MKT', 0,  '캠페인 목표와 KPI 정의',           'done',     'high',   'jiyoon.kim',  -12,  -5,   '{growth}',             null,  'none',   4),
  ('MKT', 1,  '타깃 고객 페르소나 정리',          'progress', 'medium', 'minjae.jung', -4,   2,    '{research,content}',   null,  'none',   null),
  ('MKT', 2,  '랜딩 페이지 헤드라인 초안',        'todo',     'high',   'yujin.han',   null, 4,    '{content}',            null,  'none',   null),
  ('MKT', 3,  'SNS 광고 소재 기획',               'backlog',  'medium', 'haeun.choi',  6,    13,   '{design,growth}',      null,  'none',   null),
  ('MKT', 4,  '뉴스레터 발송 일정 수립',          'todo',     'low',    'minjae.jung', null, 6,    '{content}',            null,  'none',   null),
  ('MKT', 5,  '채널별 예산 배분',                 'backlog',  'medium', 'jiyoon.kim',  null, null, '{growth}',             null,  'none',   null),
  ('MKT', 6,  '협업 크리에이터 후보 조사',        'todo',     'medium', 'minjae.jung', 1,    8,    '{research}',           null,  'none',   null),
  -- 제품 출시 6
  ('LCH', 0,  '출시 일정 리스크 점검',            'progress', 'urgent', 'jiyoon.kim',  -7,   -3,   '{research}',           null,  'none',   null),
  ('LCH', 1,  '보도자료 초안 작성',               'review',   'high',   'minjae.jung', -4,   0,    '{content}',            '4h',  'none',   null),
  ('LCH', 2,  '출시 체크리스트 최종 확인',        'todo',     'high',   'jiyoon.kim',  -1,   0,    '{qa}',                 '4h',  'none',   null),
  ('LCH', 3,  '결제 연동 장애 대응',              'progress', 'urgent', 'taeo.kang',   -5,   -1,   '{bug,backend}',        null,  'none',   null),
  ('LCH', 4,  '출시 공지 이메일 준비',            'backlog',  'medium', 'minjae.jung', 3,    10,   '{content,growth}',     null,  'none',   null),
  ('LCH', 5,  '출시 회고 일정 잡기',              'todo',     'low',    'jiyoon.kim',  null, 16,   '{}',                   null,  'none',   null),
  -- 디자인 시스템 6
  ('DS',  0,  '버튼 컴포넌트 변형 정리',          'done',     'medium', 'haeun.choi',  -15,  -9,   '{design,frontend}',    null,  'none',   8),
  ('DS',  1,  '색상 토큰 명명 규칙 확정',         'review',   'high',   'seojun.park', -5,   1,    '{design}',             null,  'none',   null),
  ('DS',  2,  '아이콘 세트 점검',                 'progress', 'medium', 'haeun.choi',  -2,   4,    '{design}',             null,  'none',   null),
  ('DS',  3,  '입력 필드 접근성 개선',            'todo',     'high',   'dohyun.lee',  2,    7,    '{frontend,qa}',        '2d',  'none',   null),
  ('DS',  4,  '컴포넌트 문서 사이트 구축',        'backlog',  'medium', 'dohyun.lee',  10,   24,   '{frontend,content}',   '5d',  'none',   null),
  ('DS',  5,  '월간 디자인 시스템 공유회',        'todo',     'low',    'seojun.park', null, 11,   '{design}',             null,  'monthly', null),
  -- 고객 포털 1
  ('CP',  0,  '고객 포털 요구사항 재검토',        'backlog',  'medium', 'taeo.kang',   null, null, '{research,backend}',   null,  'none',   null),
  -- 마케팅 웹사이트 2
  ('MW',  0,  '랜딩 페이지 최종 배포',            'done',     'high',   'dohyun.lee',  -40,  -30,  '{frontend}',           null,  'none',   30),
  ('MW',  1,  '캠페인 성과 리포트 작성',          'done',     'medium', 'minjae.jung', -32,  -25,  '{content,growth}',     null,  'none',   25),
  -- 달빛 랩스 3
  ('EXP', 0,  '실험 지표 정의 문서 작성',         'todo',     'high',   'serin.oh',    null, 3,    '{research}',           null,  'none',   null),
  ('EXP', 1,  '결과 차트 구현',                   'progress', 'medium', 'jiyoon.kim',  -2,   5,    '{frontend}',           null,  'none',   null),
  ('EXP', 2,  '이벤트 수집 파이프라인 점검',      'backlog',  'medium', 'serin.oh',    null, null, '{backend}',            null,  'none',   null),
  -- 별빛 커머스 2
  ('SHOP', 0, '상품 상세 페이지 구성',            'todo',     'high',   'jaewon.lim',  null, 7,    '{design}',             null,  'none',   null),
  ('SHOP', 1, '배송 정책 문서화',                 'backlog',  'low',    'jaewon.lim',  null, null, '{content}',            null,  'none',   null)
) v(pkey, n, title, status, priority, who, s, d, labels, est, recur, done_ago)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

insert into public.subtasks (task_id, title, done, assignee_id, sort_order)
select pg_temp.t(v.key), v.title, v.done, pg_temp.u(v.who), v.n * 1000
from (values
  ('WEB-100', 1, '시안 A·B 비교표 작성',      true,  'haeun.choi'),
  ('WEB-100', 2, '카피 길이 확인',            false, 'minjae.jung'),
  ('WEB-100', 3, '최종안 공유',               false, 'haeun.choi'),
  ('WEB-103', 1, '브레이크포인트 정의',       true,  'dohyun.lee'),
  ('WEB-103', 2, '햄버거 메뉴 구현',          true,  'dohyun.lee'),
  ('WEB-103', 3, '키보드 탐색 확인',          false, 'sora.yoon'),
  ('WEB-103', 4, '태블릿 화면 확인',          false, null),
  ('MOB-103', 1, 'iOS 권한 문구 작성',        false, 'minjae.jung'),
  ('MOB-103', 2, 'Android 13 권한 처리',      false, 'dohyun.lee'),
  ('MOB-103', 3, '거부 시 안내 화면',         false, 'haeun.choi'),
  ('LCH-106', 1, '결제 경로 점검',            true,  'sora.yoon'),
  ('LCH-106', 2, '요금제 문구 확인',          true,  'minjae.jung'),
  ('LCH-106', 3, '롤백 절차 확인',            true,  'taeo.kang'),
  ('LCH-106', 4, '고객 지원 공지 준비',       false, 'jiyoon.kim'),
  ('DS-106',  1, '중복 아이콘 정리',          true,  'haeun.choi'),
  ('DS-106',  2, '선 굵기 통일',              false, 'haeun.choi'),
  ('MKT-103', 1, '인터뷰 메모 정리',          true,  'minjae.jung'),
  ('MKT-103', 2, '페르소나 3종 초안',         true,  'minjae.jung'),
  ('WEB-148', 1, '측정 대상 페이지 선정',     false, 'taeo.kang'),
  ('WEB-148', 2, 'Lighthouse 기준값 기록',    false, 'sora.yoon'),
  ('WEB-148', 3, '개선 항목 정리',            false, null)
) v(key, n, title, done, who);

-- (작업, 이 작업을 막는 작업). 모두 같은 프로젝트 안이다.
insert into public.task_deps (task_id, blocked_by_id)
select pg_temp.t(v.task), pg_temp.t(v.blocker)
from (values
  ('WEB-148', 'WEB-103'),
  ('WEB-118', 'WEB-100'),
  ('WEB-142', 'WEB-139'),
  ('MOB-124', 'MOB-106'),
  ('LCH-106', 'LCH-109'),
  ('DS-109',  'DS-103')
) v(task, blocker);

-- ─────────────────────────────────────────────
-- 댓글·반응
-- ─────────────────────────────────────────────
insert into public.comments (id, task_id, author_id, body, created_at, updated_at)
select v.id::uuid, pg_temp.t(v.key), pg_temp.u(v.who), v.body, now() - v.ago, now() - v.ago
from (values
  ('a0c00000-0000-4000-8000-000000000001', 'WEB-100', 'haeun.choi',  '@김지윤 히어로 카피 최종안 확인 부탁드려요.',                      interval '25 minutes'),
  ('a0c00000-0000-4000-8000-000000000002', 'WEB-100', 'seojun.park', '시안 B의 여백이 더 안정적으로 보여요. B로 가면 좋겠습니다.',      interval '2 hours'),
  ('a0c00000-0000-4000-8000-000000000003', 'WEB-100', 'dohyun.lee',  '이미지 비율은 16:9로 고정해 두었어요.',                           interval '1 hour'),
  ('a0c00000-0000-4000-8000-000000000004', 'WEB-109', 'taeo.kang',   '서버 쪽 검증은 이메일 형식부터 넣고 있습니다.',                    interval '4 hours'),
  ('a0c00000-0000-4000-8000-000000000005', 'MOB-106', 'taeo.kang',   '토큰 만료 시간을 1시간으로 줄였어요. 리뷰 부탁드립니다.',          interval '1 day'),
  ('a0c00000-0000-4000-8000-000000000006', 'MOB-106', 'sora.yoon',   '갱신 실패 시 재시도 케이스 테스트를 추가해 주세요.',               interval '20 hours'),
  ('a0c00000-0000-4000-8000-000000000007', 'LCH-100', 'taeo.kang',   '결제 연동 이슈가 해결돼야 일정 확정이 가능할 것 같아요.',          interval '3 hours'),
  ('a0c00000-0000-4000-8000-000000000008', 'LCH-106', 'sora.yoon',   '체크리스트 4개 중 3개 확인 끝났습니다.',                           interval '30 minutes'),
  ('a0c00000-0000-4000-8000-000000000009', 'MKT-100', 'minjae.jung', 'KPI 문서 공유했습니다. 의견 남겨 주세요.',                        interval '5 hours')
) v(id, key, who, body, ago);

insert into public.comment_reactions (comment_id, user_id, emoji) values
  ('a0c00000-0000-4000-8000-000000000002', pg_temp.u('jiyoon.kim'),  '👍'),
  ('a0c00000-0000-4000-8000-000000000002', pg_temp.u('haeun.choi'),  '👍'),
  ('a0c00000-0000-4000-8000-000000000005', pg_temp.u('dohyun.lee'),  '👀'),
  ('a0c00000-0000-4000-8000-000000000008', pg_temp.u('jiyoon.kim'),  '🎉'),
  ('a0c00000-0000-4000-8000-000000000009', pg_temp.u('haeun.choi'),  '❤️');

-- ─────────────────────────────────────────────
-- 파일. 경로 {workspace_id}/{project_id}/{file_id}/{object_name}
-- name은 화면에 보이는 원본 이름(한글), object_name은 Storage 키용 ASCII 이름이다(Storage가 한글 키를 거부한다).
-- size_bytes는 scripts/seed-files.mjs가 올리는 실제 내용 길이와 같아야 한다(다르면 그 행은 failed).
-- ─────────────────────────────────────────────
insert into public.files (id, workspace_id, project_id, task_id, name, object_name, type, mime, size_bytes, storage_path, status, uploaded_by, created_at, updated_at)
select v.id::uuid, pr.workspace_id, pr.id, pg_temp.t(v.task), v.name, v.obj, v.type::public.file_type, v.mime, v.size,
       pr.workspace_id || '/' || pr.id || '/' || v.id || '/' || v.obj, 'pending', pg_temp.u(v.who),
       now() - v.ago, now() - v.ago
from (values
  ('a0f00000-0000-4000-8000-000000000001', 'WEB', 'WEB-100', '홈페이지_시안_v3.fig', 'homepage-hero-v3.fig', 'fig',   'application/x-figma', 52,  'haeun.choi',  interval '5 hours'),
  ('a0f00000-0000-4000-8000-000000000002', 'WEB', null,      '브랜드_가이드라인.pdf', 'brand-guidelines.pdf', 'pdf',   'application/pdf',     408, 'seojun.park', interval '10 days'),
  ('a0f00000-0000-4000-8000-000000000003', 'WEB', 'WEB-100', '히어로_배너.png', 'hero-banner.png',      'img',   'image/png',           70,  'haeun.choi',  interval '1 day'),
  ('a0f00000-0000-4000-8000-000000000004', 'DS',  'DS-106',  '아이콘_에셋.zip', 'icon-assets.zip',      'zip',   'application/zip',     22,  'haeun.choi',  interval '2 days'),
  ('a0f00000-0000-4000-8000-000000000005', 'MKT', null,      '콘텐츠_캘린더.csv', 'content-calendar.csv', 'sheet', 'text/csv',            100, 'minjae.jung', interval '3 days'),
  ('a0f00000-0000-4000-8000-000000000006', 'WEB', 'WEB-112', '킥오프_회의록.txt', 'kickoff-notes.txt',    'doc',   'text/plain',          52,  'jiyoon.kim',  interval '12 days'),
  ('a0f00000-0000-4000-8000-000000000007', 'MOB', 'MOB-106', '인증_API_스키마.json', 'auth-api-schema.json', 'code',  'application/json',    73,  'taeo.kang',   interval '1 day'),
  ('a0f00000-0000-4000-8000-000000000008', 'MOB', null,      '앱_아이콘.png', 'app-icon.png',         'img',   'image/png',           70,  'haeun.choi',  interval '6 days'),
  ('a0f00000-0000-4000-8000-000000000009', 'LCH', 'LCH-106', '출시_체크리스트.pdf', 'launch-checklist.pdf', 'pdf',   'application/pdf',     408, 'sora.yoon',   interval '2 days'),
  ('a0f00000-0000-4000-8000-000000000010', 'LCH', null,      '릴리스_노트.txt', 'release-notes.txt',    'doc',   'text/plain',          47,  'minjae.jung', interval '1 day'),
  ('a0f00000-0000-4000-8000-000000000011', 'DS',  'DS-103',  '디자인_토큰.json', 'design-tokens.json',   'code',  'application/json',    75,  'seojun.park', interval '4 days'),
  ('a0f00000-0000-4000-8000-000000000012', 'MKT', 'MKT-103', '고객_인터뷰_메모.md', 'research-memo.md',     'other', 'text/plain',          61,  'minjae.jung', interval '2 days')
) v(id, pkey, task, name, obj, type, mime, size, who, ago)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

-- ─────────────────────────────────────────────
-- 활동 13. extra는 rpc 마이그레이션의 활동 트리거가 verb별로 넣는 형식을 그대로 따른다.
-- ─────────────────────────────────────────────
insert into public.activities (workspace_id, project_id, task_id, actor_id, verb, extra, created_at)
select pr.workspace_id, pr.id, pg_temp.t(v.task), pg_temp.u(v.who), v.verb, v.extra, now() - v.ago
from (values
  ('WEB', 'WEB-100', 'seojun.park', 'moved',                     jsonb_build_object('from', 'progress', 'to', 'review'), interval '38 minutes'),
  ('WEB', 'WEB-151', 'haeun.choi',  'completed',                 jsonb_build_object('from', 'review', 'to', 'done'),     interval '1 day'),
  ('WEB', 'WEB-100', 'haeun.choi',  'commented on',              jsonb_build_object('comment_id', 'a0c00000-0000-4000-8000-000000000001'), interval '25 minutes'),
  ('WEB', 'WEB-109', 'taeo.kang',   'changed priority of',       jsonb_build_object('from', 'high', 'to', 'urgent'),     interval '3 hours'),
  ('WEB', 'WEB-100', 'haeun.choi',  'added a file to',           jsonb_build_object('file_id', 'a0f00000-0000-4000-8000-000000000001', 'name', '홈페이지_시안_v3.fig'), interval '5 hours'),
  ('WEB', 'WEB-139', 'dohyun.lee',  'created',                   '{}'::jsonb,                                             interval '6 hours'),
  ('MOB', 'MOB-106', 'jiyoon.kim',  'assigned',                  jsonb_build_object('from', null, 'to', pg_temp.u('taeo.kang')), interval '1 day'),
  ('DS',  null,      'haeun.choi',  'created project',           '{}'::jsonb,                                             interval '45 days'),
  ('LCH', 'LCH-100', 'jiyoon.kim',  'changed due date of',       jsonb_build_object('from', current_date - 1, 'to', current_date - 3), interval '2 days'),
  ('MOB', 'MOB-115', 'sora.yoon',   'updated labels on',         jsonb_build_object('from', array['bug'], 'to', array['bug', 'qa']), interval '3 days'),
  ('MOB', 'MOB-121', 'sora.yoon',   'set repeat on',             jsonb_build_object('to', 'daily'),                      interval '4 days'),
  ('LCH', 'LCH-106', 'sora.yoon',   'completed subtask on',
     (select jsonb_build_object('subtask_id', s.id, 'title', s.title) from public.subtasks s
      where s.task_id = pg_temp.t('LCH-106') and s.title = '롤백 절차 확인'),                                                 interval '20 minutes'),
  ('LCH', null,      'jiyoon.kim',  'changed status of project', jsonb_build_object('from', 'active', 'to', 'risk'),     interval '2 days')
) v(pkey, task, who, verb, extra, ago)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

-- ─────────────────────────────────────────────
-- 알림 10. 수신자는 모두 김지윤(hanbit). read_at이 있으면 읽음
-- 문구·발췌는 서버 트리거와 같다. 서버가 만들지 않는 update 유형은 넣지 않는다.
-- 작업 알림은 같은 프로젝트를 함께 넣는다(복합 FK).
-- ─────────────────────────────────────────────
insert into public.notifications (user_id, workspace_id, type, actor_id, task_id, project_id, text, snippet, read_at, created_at)
select pg_temp.u('jiyoon.kim'), pg_temp.ws('hanbit'), v.type::public.notification_type, pg_temp.u(v.who),
       pg_temp.t(v.task), pg_temp.p(v.pkey), v.text, v.snippet,
       case when v.is_read then now() - v.ago + interval '10 minutes' end, now() - v.ago
from (values
  ('mention', 'haeun.choi',  'WEB-100', 'WEB', '댓글에서 회원님을 멘션했습니다',     '@김지윤 히어로 카피 최종안 확인 부탁드려요.',        false, interval '25 minutes'),
  ('assign',  'seojun.park', 'LCH-106', 'LCH', '회원님을 담당자로 지정했습니다',     null,                                               false, interval '1 hour'),
  ('comment', 'taeo.kang',   'LCH-100', 'LCH', '회원님의 작업에 댓글을 남겼습니다',  '결제 연동 이슈가 해결돼야 일정 확정이 가능할 것 같아요.', false, interval '3 hours'),
  ('assign',  'minjae.jung', 'LCH-115', 'LCH', '회원님을 담당자로 지정했습니다',     null,                                               true,  interval '2 days'),
  ('assign',  'seojun.park', 'WEB-133', 'WEB', '회원님을 담당자로 지정했습니다',     null,                                               true,  interval '1 day'),
  ('comment', 'minjae.jung', 'MKT-100', 'MKT', '회원님의 작업에 댓글을 남겼습니다',  'KPI 문서 공유했습니다. 의견 남겨 주세요.',           false, interval '5 hours'),
  ('assign',  'seojun.park', 'MKT-115', 'MKT', '회원님을 담당자로 지정했습니다',     null,                                               false, interval '3 hours'),
  ('assign',  'sora.yoon',   'MOB-109', 'MOB', '회원님을 담당자로 지정했습니다',     null,                                               true,  interval '4 days'),
  ('comment', 'sora.yoon',   'LCH-106', 'LCH', '회원님의 작업에 댓글을 남겼습니다',  '체크리스트 4개 중 3개 확인 끝났습니다.',              false, interval '30 minutes'),
  ('assign',  'taeo.kang',   'LCH-100', 'LCH', '회원님을 담당자로 지정했습니다',     null,                                               true,  interval '1 day')
) v(type, who, task, pkey, text, snippet, is_read, ago);

-- ─────────────────────────────────────────────
-- 일정 6·저장 뷰 1·즐겨찾기
-- ─────────────────────────────────────────────
insert into public.events (workspace_id, project_id, title, date, time, created_by)
select pr.workspace_id, pr.id, v.title, current_date + v.d, v.t::time, pg_temp.u(v.who)
from (values
  ('LCH', '출시 점검 회의',       0,  '15:00', 'jiyoon.kim'),
  ('WEB', '디자인 리뷰',          2,  '10:00', 'seojun.park'),
  ('MOB', '스프린트 계획',        4,  null,    'dohyun.lee'),
  ('MKT', '캠페인 킥오프',        7,  '14:00', 'minjae.jung'),
  ('DS',  '디자인 시스템 공유회', 11, null,    'haeun.choi'),
  ('WEB', '웹사이트 정식 오픈',   21, null,    'jiyoon.kim')
) v(pkey, title, d, t, who)
join public.projects pr on pr.id = pg_temp.p(v.pkey);

insert into public.saved_views (workspace_id, project_id, name, type, filters, created_by)
values (pg_temp.ws('hanbit'), pg_temp.p('WEB'), '높은 우선순위', 'list',
        '[{"f":"priority","op":"is","v":["urgent","high"]}]', pg_temp.u('jiyoon.kim'));

insert into public.favorites (user_id, workspace_id, project_id) values
  (pg_temp.u('jiyoon.kim'), pg_temp.ws('hanbit'), pg_temp.p('WEB')),
  (pg_temp.u('jiyoon.kim'), pg_temp.ws('hanbit'), pg_temp.p('MOB'));
