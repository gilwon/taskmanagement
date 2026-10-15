-- 데모 사본(013) 보안 보완. 사본 생성자 기록·공유 구성원 선점 방지·익명 사용자 자격 변경 차단을 넓힌다.

-- ─────────────────────────────────────────────
-- 공유 구성원(013 시드 루프를 분리)
-- ─────────────────────────────────────────────
-- 모든 사본이 같이 쓰는 demo_seed 계정 5명을 이메일로 찾고, 없으면 무작위 비밀번호와 banned_until로 막아 만든다.
-- 같은 주소의 데모가 아닌 계정이 있으면 그 계정을 쓰지 않고 demo_member_conflict로 멈춘다.
-- local(hana.song 등)을 키로 하는 id 맵을 돌려준다.
-- 이 마이그레이션 끝에서 한 번 불러 미리 만든다. 첫 RPC 때 만들면 그 전에 누군가 같은 이메일로 가입해 데모를 영구히 막을 수 있다.
create function private.ensure_demo_members()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_u jsonb := '{}'::jsonb;
  v_id uuid;
  r record;
begin
  for r in
    select * from (values
      ('hana.song',   'hana.song@demo.example.com',   '송하나', 'violet'),
      ('woojin.bae',  'woojin.bae@demo.example.com',  '배우진', 'blue'),
      ('eunji.seo',   'eunji.seo@demo.example.com',   '서은지', 'rose'),
      ('hyunwoo.nam', 'hyunwoo.nam@demo.example.com', '남현우', 'teal'),
      ('yerin.kwon',  'yerin.kwon@demo.example.com',  '권예린', 'amber')
    ) v(local, email, name, color)
  loop
    select u.id into v_id from auth.users u where lower(u.email) = r.email;
    if found then
      if not exists (select 1 from auth.users u where u.id = v_id and u.raw_app_meta_data ->> 'demo_seed' = 'true') then
        raise exception using errcode = 'P0001', message = 'demo_member_conflict';
      end if;
    else
      v_id := gen_random_uuid();
      -- GoTrue는 토큰 컬럼이 null이면 로그인 조회에서 실패하므로 빈 문자열로 채운다
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change, banned_until
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email,
        extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"],"demo_seed":true}'::jsonb, jsonb_build_object('name', r.name),
        now() - interval '30 days', now() - interval '30 days',
        '', '', '', '',
        -- GoTrue가 로그인·재설정 링크 확인을 user_banned로 거부한다
        timestamptz '2999-12-31'
      );
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true),
              'email', now(), now() - interval '30 days', now() - interval '30 days');
      update public.profiles pf set color = r.color where pf.id = v_id;
    end if;
    v_u := v_u || jsonb_build_object(r.local, v_id);
  end loop;
  return v_u;
end;
$$;

revoke execute on function private.ensure_demo_members() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 목데이터 시드(013 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. 공유 구성원은 private.ensure_demo_members()로 받고, 사본의 created_by는 호출자(p_me)다.
-- start_demo_sandbox가 created_by로 사본을 찾으므로 호출자가 자기 구성원 행을 지워도 새 사본을 만들 수 없다.
-- authenticated는 workspaces에 insert 정책이 없고 update 열 권한도 name, slug, color뿐이라 created_by를 바꿀 수 없다.
-- 나머지 시드 내용은 013과 같다.
create or replace function private.seed_demo_workspace(p_me uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_u jsonb := jsonb_build_object('me', p_me);
  v_p jsonb;
  v_t jsonb;
  v_ws uuid;
  v_slug text;
  v_id uuid;
  r record;
begin
  -- 공유 구성원
  v_u := v_u || private.ensure_demo_members();

  update public.profiles pf set color = 'indigo' where pf.id = p_me;

  -- 워크스페이스. slug가 겹치면 다시 뽑는다(md5 앞 8자는 소문자 16진수라 slug 규칙을 지킨다)
  loop
    v_slug := 'demo-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    begin
      insert into public.workspaces (name, slug, color, team_size, created_by, demo_expires_at)
      values ('데모 스튜디오', v_slug, 'violet', '2-10', p_me, now() + interval '24 hours')
      returning id into v_ws;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.teams (workspace_id, name, icon, color, description) values
    (v_ws, '제품',   'target',    'indigo', '제품 방향과 일정을 맡는다.'),
    (v_ws, '디자인', 'palette',   'violet', '앱 화면과 브랜드 디자인을 맡는다.'),
    (v_ws, '개발',   'code',      'blue',   '앱·서버 개발을 맡는다.'),
    (v_ws, '마케팅', 'megaphone', 'amber',  '캠페인과 콘텐츠를 맡는다.');

  insert into public.workspace_members (workspace_id, user_id, role, status, title, color, team_id, last_active_at)
  select v_ws, (v_u ->> v.local)::uuid, v.role::public.ws_role, 'active', v.title, v.color, tm.id, now() - v.last_active
  from (values
    ('me',          '프로젝트 매니저',     'indigo', '제품',   'admin',  interval '1 minute'),
    ('hana.song',   '대표',               'violet', '제품',   'owner',  interval '20 minutes'),
    ('woojin.bae',  '프론트엔드 엔지니어', 'blue',   '개발',   'member', interval '10 minutes'),
    ('eunji.seo',   'UX 디자이너',        'rose',   '디자인', 'member', interval '1 hour'),
    ('hyunwoo.nam', '백엔드 엔지니어',    'teal',   '개발',   'member', interval '3 hours'),
    ('yerin.kwon',  '마케터',             'amber',  '마케팅', 'member', interval '1 day')
  ) v(local, title, color, team, role, last_active)
  join public.teams tm on tm.workspace_id = v_ws and tm.name = v.team;

  -- 프로젝트 3. seq는 기본값 200(시드 키 최대 136보다 크다)이라 새 작업은 201부터 나온다
  insert into public.projects (workspace_id, key, name, icon, color, status, team_id, lead_id, start_date, due_date, description, access, created_by, created_at)
  select v_ws, v.key, v.name, v.icon, v.color, v.status::public.project_status,
         (select tm.id from public.teams tm where tm.workspace_id = v_ws and tm.name = v.team),
         (v_u ->> v.lead)::uuid, current_date + v.s, current_date + v.d, v.descr, 'workspace',
         (v_u ->> v.lead)::uuid, now() - make_interval(days => v.age)
  from (values
    ('APP', '모바일 앱 리뉴얼', 'smartphone', 'blue',  'active',   '개발',   'woojin.bae', -21, 24, '앱 첫 화면과 결제 흐름을 새로 만든다.',          25),
    ('BRD', '브랜드 캠페인',    'megaphone',  'amber', 'planning', '마케팅', 'yerin.kwon', -7,  30, '연말 브랜드 캠페인을 준비한다.',                10),
    ('OPS', '고객 지원 개선',   'target',     'rose',  'risk',     '제품',   'me',         -14, 10, '문의 응답 시간을 줄이고 도움말을 정리한다.',     18)
  ) v(key, name, icon, color, status, team, lead, s, d, descr, age);

  select jsonb_object_agg(pr.key, pr.id) into v_p from public.projects pr where pr.workspace_id = v_ws;

  -- 생성 경로(create_project)처럼 리드를 full 구성원으로 넣는다
  insert into public.project_members (project_id, user_id, perm)
  select pr.id, pr.lead_id, 'full' from public.projects pr where pr.workspace_id = v_ws;

  insert into public.milestones (project_id, name, date)
  select (v_p ->> v.key)::uuid, v.name, current_date + v.d
  from (values
    ('APP', '디자인 확정',   -2),
    ('APP', '베타 배포',     12),
    ('APP', '스토어 출시',   24),
    ('BRD', '캠페인 런칭',   30),
    ('OPS', '도움말 공개',   10)
  ) v(key, name, d);

  -- 작업 27. 키는 {KEY}-{100+3n}. postgres로 key를 넣으면 assign_task_key 트리거가 그대로 둔다.
  -- s·d는 오늘 기준 시작·마감 일수, done_ago는 완료 시점(일 전)
  insert into public.tasks (
    workspace_id, project_id, key, title, status, priority, assignee_id, start_date, due_date,
    labels, estimate, recur, sort_order, completed_at, created_by, created_at
  )
  select
    pr.workspace_id, pr.id, v.pkey || '-' || (100 + 3 * v.n), v.title,
    v.status::public.task_status, v.priority::public.task_priority, (v_u ->> v.who)::uuid,
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
  join public.projects pr on pr.id = (v_p ->> v.pkey)::uuid;

  select jsonb_object_agg(t.key, t.id) into v_t from public.tasks t where t.workspace_id = v_ws;

  insert into public.subtasks (task_id, title, done, assignee_id, sort_order)
  select (v_t ->> v.key)::uuid, v.title, v.done, (v_u ->> v.who)::uuid, v.n * 1000
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

  -- (작업, 이 작업을 막는 작업). 모두 같은 프로젝트 안이다
  insert into public.task_deps (task_id, blocked_by_id)
  select (v_t ->> v.task)::uuid, (v_t ->> v.blocker)::uuid
  from (values
    ('APP-109', 'APP-106'),
    ('APP-112', 'APP-103'),
    ('BRD-106', 'BRD-103'),
    ('OPS-112', 'OPS-103')
  ) v(task, blocker);

  -- 댓글·반응
  insert into public.comments (task_id, author_id, body, created_at, updated_at)
  select (v_t ->> v.key)::uuid, (v_u ->> v.who)::uuid, v.body, now() - v.ago, now() - v.ago
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
  select c.id, (v_u ->> v.who)::uuid, v.emoji
  from (values
    ('B안이 구현하기 더 쉬워 보입니다.',                    'eunji.seo', '👍'),
    ('KPI 목표치 좋습니다. 이대로 진행하죠.',               'me',        '🎉'),
    ('첨부 파일이 크면 접수가 실패하는 문제를 찾았습니다.', 'me',        '👀')
  ) v(body, who, emoji)
  join public.comments c on c.body = v.body
  join public.tasks t on t.id = c.task_id and t.workspace_id = v_ws;

  -- 활동. extra는 rpc 마이그레이션의 활동 트리거가 verb별로 넣는 형식을 그대로 따른다
  insert into public.activities (workspace_id, project_id, task_id, actor_id, verb, extra, created_at)
  select v_ws, (v_p ->> v.pkey)::uuid, (v_t ->> v.task)::uuid, (v_u ->> v.who)::uuid, v.verb, v.extra, now() - v.ago
  from (values
    ('APP', 'APP-109', 'eunji.seo',   'moved',               jsonb_build_object('from', 'progress', 'to', 'review'), interval '2 hours'),
    ('APP', 'APP-130', 'eunji.seo',   'completed',           jsonb_build_object('from', 'review', 'to', 'done'),     interval '4 days'),
    ('APP', 'APP-106', 'hyunwoo.nam', 'changed priority of', jsonb_build_object('from', 'high', 'to', 'urgent'),     interval '1 day'),
    ('APP', 'APP-118', 'hana.song',   'assigned',            jsonb_build_object('from', null, 'to', p_me),           interval '1 day'),
    ('BRD', null,      'yerin.kwon',  'created project',     '{}'::jsonb,                                             interval '10 days'),
    ('OPS', null,      'me',          'changed status of project', jsonb_build_object('from', 'active', 'to', 'risk'), interval '1 day')
  ) v(pkey, task, who, verb, extra, ago);

  -- 알림 6. 수신자는 모두 데모 사용자. read_at이 있으면 읽음.
  -- 문구·발췌는 서버 트리거와 같다. 작업 알림은 같은 프로젝트를 함께 넣는다(복합 FK)
  insert into public.notifications (user_id, workspace_id, type, actor_id, task_id, project_id, text, snippet, read_at, created_at)
  select p_me, v_ws, v.type::public.notification_type, (v_u ->> v.who)::uuid,
         (v_t ->> v.task)::uuid, (v_p ->> v.pkey)::uuid, v.text, v.snippet,
         case when v.is_read then now() - v.ago + interval '10 minutes' end, now() - v.ago
  from (values
    ('assign',  'hana.song',   'APP-118', 'APP', '회원님을 담당자로 지정했습니다',    null,                                                false, interval '1 day'),
    ('comment', 'hana.song',   'OPS-106', 'OPS', '회원님의 작업에 댓글을 남겼습니다', '두 번째 템플릿은 조금 더 짧게 다듬어 주세요.',        false, interval '1 hour'),
    ('comment', 'hana.song',   'BRD-100', 'BRD', '회원님의 작업에 댓글을 남겼습니다', 'KPI 목표치 좋습니다. 이대로 진행하죠.',               true,  interval '2 days'),
    ('assign',  'woojin.bae',  'APP-127', 'APP', '회원님을 담당자로 지정했습니다',    null,                                                false, interval '5 hours'),
    ('assign',  'hana.song',   'OPS-106', 'OPS', '회원님을 담당자로 지정했습니다',    null,                                                true,  interval '4 days'),
    ('comment', 'woojin.bae',  'APP-118', 'APP', '회원님의 작업에 댓글을 남겼습니다', '스크린 리더 점검 목록을 공유해 주세요.',              false, interval '30 minutes')
  ) v(type, who, task, pkey, text, snippet, is_read, ago);

  -- 일정 5·저장 뷰 1·즐겨찾기
  insert into public.events (workspace_id, project_id, title, date, time, created_by)
  select v_ws, (v_p ->> v.pkey)::uuid, v.title, current_date + v.d, v.t::time, (v_u ->> v.who)::uuid
  from (values
    ('APP', '결제 흐름 점검 회의', 0,  '14:00', 'me'),
    ('APP', '스프린트 계획',       2,  '10:00', 'woojin.bae'),
    ('BRD', '캠페인 킥오프',       5,  '15:00', 'yerin.kwon'),
    ('OPS', '지원팀 회고',         8,  null,    'me'),
    ('APP', '베타 배포',           12, null,    'hana.song')
  ) v(pkey, title, d, t, who);

  insert into public.saved_views (workspace_id, project_id, name, type, filters, created_by)
  values (v_ws, (v_p ->> 'APP')::uuid, '긴급·높음', 'list',
          '[{"f":"priority","op":"is","v":["urgent","high"]}]', p_me);

  insert into public.favorites (user_id, workspace_id, project_id) values
    (p_me, v_ws, (v_p ->> 'APP')::uuid),
    (p_me, v_ws, (v_p ->> 'OPS')::uuid);

  return v_slug;
end;
$$;

-- ─────────────────────────────────────────────
-- 사본 시작(013 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. 살아 있는 사본은 구성원 행이 아니라 created_by로 찾는다. 나머지 동작은 013과 같다.
-- 013은 구성원 행으로 찾아서, 사본 admin이 자기 행을 지우고 다시 부르면 사본을 무한히 만들어 500 상한을 채울 수 있었다.
-- definer 사유. 새 워크스페이스·구성원·auth.users(공유 구성원)를 만들 정책이 호출자에게 없다.
create or replace function public.start_demo_sandbox()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_slug text;
  v_claims text;
  v_sub text;
begin
  if coalesce(auth.jwt() ->> 'is_anonymous', '') <> 'true' then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.start_demo_sandbox'));

  select w.slug into v_slug
  from public.workspaces w
  where w.created_by = v_uid and w.demo_expires_at > now()
  limit 1;
  if found then
    return v_slug;
  end if;

  if (select count(*) from public.workspaces w where w.demo_expires_at > now()) >= 500 then
    raise exception using errcode = 'P0001', message = 'demo_full';
  end if;

  v_claims := current_setting('request.jwt.claims', true);
  v_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  v_slug := private.seed_demo_workspace(v_uid);
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return v_slug;
end;
$$;

-- ─────────────────────────────────────────────
-- 익명 사용자 자격 변경 차단(013 트리거 함수 교체)
-- ─────────────────────────────────────────────
-- 바뀐 점. email_change·phone·phone_change가 바뀌는 것도 거부한다. 이메일 변경 요청·전화번호 등록으로 실제 계정이 되는 길을 막는다.
-- GoTrue가 익명 가입(INSERT)·로그인 때 하는 UPDATE는 이 값들을 바꾸지 않아 통과한다.
-- 나머지 조건(demo_seed 또는 익명 계정, supabase_auth_admin 또는 본인 JWT)은 013과 같다.
create or replace function private.guard_demo_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.raw_app_meta_data ->> 'demo_seed' = 'true' or old.is_anonymous)
     and (new.encrypted_password is distinct from old.encrypted_password
          or new.email is distinct from old.email
          or new.is_anonymous is distinct from old.is_anonymous
          or new.email_change is distinct from old.email_change
          or new.phone is distinct from old.phone
          or new.phone_change is distinct from old.phone_change)
     and (session_user = 'supabase_auth_admin' or auth.uid() = old.id) then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  return new;
end;
$$;

-- 공유 구성원을 지금 만든다(위 ensure_demo_members 설명)
select private.ensure_demo_members();
