"use client";
// 온보딩 6단계 마법사. 단계 입력은 클라이언트 상태로 두고 5단계 제출 때만 completeOnboarding을 호출한다
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { AuthCard, buttonClass, primaryHover } from "@/components/auth/auth-card";
import { Field, FormAlert, SubmitButton } from "@/components/auth/form-parts";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/auth/actions";
import { GENERIC_ERROR, MSG } from "@/lib/auth/errors";
import {
  EMAIL_RE,
  SLUG_RE,
  TEAM_SIZES,
  TEMPLATES,
  USAGES,
  suggestSlug,
  type OnboardingInput,
} from "@/lib/auth/rules";
import { cn } from "@/lib/utils";

const TOTAL = 6;

const STEPS: Record<number, { title: string; description: string }> = {
  1: { title: "어떤 용도로 쓰시나요?", description: "용도에 맞게 시작 화면을 준비합니다." },
  2: { title: "워크스페이스 만들기", description: "팀이 함께 쓸 공간의 이름과 주소를 정해 주세요." },
  3: { title: "몇 명이 함께 일하나요?", description: "혼자 쓰는지, 팀으로 쓰는지 알려 주세요." },
  4: { title: "첫 프로젝트", description: "프로젝트 이름과 시작 템플릿을 고르세요. 템플릿에 맞는 작업이 미리 들어갑니다." },
  5: { title: "팀원 초대", description: "함께 일할 사람의 이메일을 입력하세요. 나중에 초대해도 됩니다." },
  6: { title: "워크스페이스가 준비되었습니다", description: "이제 작업을 추가하고 팀과 함께 진행 상황을 관리해 보세요." },
};

// 서버 오류 칸이 어느 단계에 있는지
function stepOf(field: string) {
  if (field === "usage") return 1;
  if (field === "name" || field === "slug") return 2;
  if (field === "teamSize") return 3;
  if (field === "projectName" || field === "template") return 4;
  return 5;
}

type Errors = Record<string, string>;

function validate(step: number, v: OnboardingInput): Errors {
  const e: Errors = {};
  if (step === 1 && !v.usage) e.usage = MSG.usageRequired;
  if (step === 2) {
    if (!v.name.trim()) e.name = MSG.workspaceNameRequired;
    else if (v.name.trim().length > 80) e.name = MSG.workspaceNameTooLong;
    if (!SLUG_RE.test(v.slug)) {
      e.slug = MSG.slugInvalid;
    }
  }
  if (step === 3 && !v.teamSize) e.teamSize = MSG.teamSizeRequired;
  if (step === 4) {
    if (!v.projectName.trim()) e.projectName = MSG.projectNameRequired;
    if (!v.template) e.template = MSG.templateRequired;
  }
  if (step === 5) {
    v.invites.forEach((mail, i) => {
      if (mail.trim() && !EMAIL_RE.test(mail.trim())) e[`invite-${i}`] = MSG.emailInvalid;
    });
  }
  return e;
}

function Choices({
  name,
  labelledBy,
  options,
  value,
  onChange,
  error,
  columns = 1,
}: {
  name: string;
  labelledBy: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  columns?: 1 | 2;
}) {
  return (
    <div className="flex flex-col gap-[var(--s-2)]">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn("grid gap-[var(--s-2)]", columns === 2 && "min-[480px]:grid-cols-2")}
      >
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex min-h-[var(--h-lg)] cursor-pointer items-center gap-[var(--s-3)] rounded-[var(--r)] border px-[var(--s-3)] py-[var(--s-2)]",
              "border-[var(--border-strong)] text-[length:var(--fs-base)] text-[var(--text)] hover:bg-[var(--surface-2)]",
              "has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]",
              "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-[var(--accent-line)]",
              error && "border-[var(--red)]",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              className="size-4 accent-[var(--accent)]"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-[length:var(--fs-xs)] text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<OnboardingInput>({
    usage: "",
    name: "",
    slug: "",
    teamSize: "",
    projectName: "",
    template: "blank",
    invites: ["", "", ""],
  });
  // 사용자가 URL을 직접 고치기 전까지는 이름에서 자동으로 제안한다
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [doneSlug, setDoneSlug] = useState<string>();
  const [pending, startTransition] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // 단계가 바뀌면 제목으로, 오류가 있으면 첫 오류 칸으로 포커스를 옮긴다
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const root = cardRef.current;
    const invalid = root?.querySelector<HTMLElement>("[aria-invalid=true]");
    const target = invalid?.getAttribute("role") === "radiogroup" ? invalid.querySelector("input") : invalid;
    (target ?? root?.querySelector<HTMLElement>("#auth-title"))?.focus();
  }, [step, errors]);

  // 단계가 바뀌면 #sr-live로 진행 단계와 제목을 알린다. 첫 진입은 알리지 않는다
  const [announce, setAnnounce] = useState("");
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    setAnnounce(`${TOTAL}단계 중 ${step}단계, ${STEPS[step].title}`);
  }, [step]);

  const set = (patch: Partial<OnboardingInput>) => setValues((v) => ({ ...v, ...patch }));

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const found = validate(step, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      try {
        const result = await completeOnboarding(values);
        if (result && "ok" in result) {
          setDoneSlug(result.slug ?? values.slug);
          setStep(6);
        } else if (result && "error" in result) {
          const { field, message } = result.error;
          if (field) {
            setStep(stepOf(field));
            setErrors({ [field]: message });
          } else {
            setFormError(message);
          }
        }
      } catch {
        // 네트워크 오류 등. 입력은 그대로 두고 다시 시도하게 한다
        setFormError(GENERIC_ERROR);
      }
    });
  }

  const meta = STEPS[step];
  return (
    <div ref={cardRef} className="w-full max-w-[480px]">
      <AuthCard
        title={meta.title}
        description={meta.description}
        className="max-w-none"
      >
        <div className="mb-[var(--s-6)] flex items-center gap-[var(--s-3)]">
          <div
            role="progressbar"
            aria-label="온보딩 진행"
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-valuenow={step}
            aria-valuetext={`${TOTAL}단계 중 ${step}단계`}
            className="h-1 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--surface-3)]"
          >
            <div className="h-full bg-[var(--accent)]" style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>
          <span className="text-[length:var(--fs-xs)] tabular-nums text-[var(--text-3)]" aria-hidden>
            {step}/{TOTAL}
          </span>
        </div>

        {step === 6 ? (
          <Button asChild className={cn(buttonClass, primaryHover)}>
            <Link href={`/${doneSlug}/home`}>워크스페이스로 이동</Link>
          </Button>
        ) : (
          <form method="post" onSubmit={next} noValidate className="flex flex-col gap-[var(--s-4)]">
            <FormAlert message={formError} />

            {step === 1 && (
              <>
                <Choices
                  name="usage"
                  labelledBy="auth-title"
                  options={USAGES}
                  value={values.usage}
                  onChange={(usage) => set({ usage })}
                  error={errors.usage}
                  columns={2}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Field
                  id="name"
                  label="워크스페이스 이름"
                  placeholder="예: 한빛 스튜디오"
                  autoComplete="organization"
                  maxLength={80}
                  required
                  value={values.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    set(slugTouched ? { name } : { name, slug: suggestSlug(name) });
                  }}
                  error={errors.name}
                />
                <Field
                  id="slug"
                  label="워크스페이스 URL"
                  placeholder="예: hanbit-studio"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={39}
                  required
                  value={values.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: e.target.value.toLowerCase() });
                  }}
                  hint={`주소는 /${values.slug || "url"}/home 형태가 됩니다. 영문 소문자·숫자·하이픈만 쓸 수 있습니다.`}
                  error={errors.slug}
                />
              </>
            )}

            {step === 3 && (
              <>
                <Choices
                  name="teamSize"
                  labelledBy="auth-title"
                  options={TEAM_SIZES}
                  value={values.teamSize}
                  onChange={(teamSize) => set({ teamSize })}
                  error={errors.teamSize}
                />
              </>
            )}

            {step === 4 && (
              <>
                <Field
                  id="projectName"
                  label="프로젝트 이름"
                  placeholder="예: 웹사이트 개편"
                  required
                  value={values.projectName}
                  onChange={(e) => set({ projectName: e.target.value })}
                  error={errors.projectName}
                />
                <span id="template-label" className="text-[length:var(--fs-sm)] font-medium text-[var(--text-2)]">
                  템플릿
                </span>
                <Choices
                  name="template"
                  labelledBy="template-label"
                  options={TEMPLATES}
                  value={values.template}
                  onChange={(template) => set({ template })}
                  error={errors.template}
                  columns={2}
                />
              </>
            )}

            {step === 5 &&
              values.invites.map((mail, i) => (
                <Field
                  key={i}
                  id={`invite-${i}`}
                  label={`초대할 이메일 ${i + 1} (선택)`}
                  type="email"
                  placeholder="teammate@example.com"
                  autoComplete="off"
                  value={mail}
                  onChange={(e) => set({ invites: values.invites.map((m, j) => (j === i ? e.target.value : m)) })}
                  error={errors[`invite-${i}`]}
                />
              ))}

            <div className="mt-[var(--s-2)] flex gap-[var(--s-2)]">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setErrors({});
                    setFormError(undefined);
                    setStep(step - 1);
                  }}
                  className={cn(buttonClass, "flex-1")}
                >
                  이전
                </Button>
              )}
              <SubmitButton pending={pending} className="flex-1">
                {step < 5 ? "다음" : pending ? "만드는 중…" : "워크스페이스 만들기"}
              </SubmitButton>
            </div>
          </form>
        )}
      </AuthCard>
      <div id="sr-live" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
