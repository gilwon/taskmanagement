-- 작업 제목·상태·우선순위·마감일 변경 시 담당자에게 update 알림을 보내도록 on_task_written을 교체한다.
-- 바뀐 점. 같은 UPDATE에서 담당자가 바뀌면 assign이 맡으므로 update는 보내지 않는다.
-- 여러 필드가 한 번에 바뀌어도 알림은 1건이다. 행위자 본인·권한 없음·notif_prefs.update=false는 private.notify가 걸러 낸다.
-- 나머지 동작은 rpc 마이그레이션과 같다. create or replace라 기존 revoke(트리거 함수 실행 권한)가 유지된다.
create or replace function public.on_task_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform private.log_activity(new.project_id, new.id, 'created');
    perform private.notify(new.assignee_id, 'assign', new.project_id, new.id,
                           '회원님을 담당자로 지정했습니다', null);
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'done' then
      perform private.log_activity(new.project_id, new.id, 'completed',
                                   jsonb_build_object('from', old.status, 'to', new.status));
      -- 반복 작업은 어느 경로(complete_task·move_task·직접 update)로 done이 되든 다음 회차를 만든다.
      -- recur_source_id unique라 다시 done이 되어도 회차는 하나뿐이다.
      if new.recur <> 'none' and new.deleted_at is null then
        perform private.spawn_next_occurrence(new.id);
      end if;
    else
      perform private.log_activity(new.project_id, new.id, 'moved',
                                   jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform private.log_activity(new.project_id, new.id, 'assigned',
                                 jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
    perform private.notify(new.assignee_id, 'assign', new.project_id, new.id,
                           '회원님을 담당자로 지정했습니다', null);
  end if;
  if new.priority is distinct from old.priority then
    perform private.log_activity(new.project_id, new.id, 'changed priority of',
                                 jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.due_date is distinct from old.due_date then
    perform private.log_activity(new.project_id, new.id, 'changed due date of',
                                 jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.start_date is distinct from old.start_date then
    perform private.log_activity(new.project_id, new.id, 'changed start date of',
                                 jsonb_build_object('from', old.start_date, 'to', new.start_date));
  end if;
  if new.labels is distinct from old.labels then
    perform private.log_activity(new.project_id, new.id, 'updated labels on',
                                 jsonb_build_object('from', old.labels, 'to', new.labels));
  end if;
  if new.title is distinct from old.title then
    perform private.log_activity(new.project_id, new.id, 'renamed',
                                 jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  if new.recur is distinct from old.recur then
    perform private.log_activity(new.project_id, new.id, 'set repeat on', jsonb_build_object('to', new.recur));
  end if;
  if new.estimate is distinct from old.estimate then
    perform private.log_activity(new.project_id, new.id, 'estimated', jsonb_build_object('to', new.estimate));
  end if;
  if old.archived_at is null and new.archived_at is not null then
    perform private.log_activity(new.project_id, new.id, 'archived');
  end if;
  if (old.archived_at is not null and new.archived_at is null)
     or (old.deleted_at is not null and new.deleted_at is null) then
    perform private.log_activity(new.project_id, new.id, 'restored');
  end if;
  -- 담당자가 그대로인 채 제목·상태·우선순위·마감일이 바뀌면 담당자에게 알린다(1건).
  if new.assignee_id is not distinct from old.assignee_id
     and (new.title is distinct from old.title
          or new.status is distinct from old.status
          or new.priority is distinct from old.priority
          or new.due_date is distinct from old.due_date) then
    perform private.notify(new.assignee_id, 'update', new.project_id, new.id,
                           '담당 작업이 수정되었습니다', null);
  end if;
  return null;
end;
$$;
