# taskmanagement

Linear·Asana 계열의 밀도 높은 화면을 갖춘 한국어 프로젝트 관리 워크스페이스다. 로그인, 업무 데이터 저장, 파일 업로드가 실제 Supabase(Auth·Postgres·Storage)와 연결되어 동작한다.

> 개발 중이다. 화면과 기능은 단계별로 추가된다.

## 주요 기능 (목표)

- 이메일·비밀번호 가입, 이메일 확인, 로그인, 비밀번호 재설정, 온보딩
- 홈, 프로젝트(보드·목록·표·파일·개요), 작업, 캘린더, 타임라인, 내 작업, 수신함, 알림, 검색, 구성원, 팀, 활동, 보관함, 설정
- 작업 드로어, 커맨드 팔레트(⌘K), 키보드 단축키, 드래그앤드롭
- 워크스페이스 단위 데이터 격리, 비공개 프로젝트 권한(RLS)
- 밝은·어두운 테마, 강조색 6종, 밀도 설정

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16.3.8 (App Router), React 19, TypeScript |
| 스타일 | Tailwind CSS 4, shadcn/ui, Lucide 아이콘, Geist 폰트 |
| 백엔드 | Supabase Auth·Postgres·Storage, `@supabase/ssr` |
| 테스트 | Vitest, pgTAP(`supabase test db`) |
| 패키지 매니저 | pnpm |

## 시작하기

### 준비물

- Node.js, pnpm
- Docker 런타임(예 colima). 로컬 Supabase 스택을 띄울 때 필요하다.
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

### 실행 순서

1. 의존성을 설치한다.
   ```bash
   pnpm install
   ```
2. Docker 런타임을 켠 뒤 로컬 Supabase를 띄운다.
   ```bash
   colima start
   supabase start
   ```
3. `.env.example`을 `.env.local`로 복사한다. `supabase status`가 보여 주는 API URL과 publishable 키를 넣는다.
   ```bash
   cp .env.example .env.local
   supabase status
   ```
4. 개발 서버를 실행하고 http://localhost:3000 에 접속한다.
   ```bash
   pnpm dev
   ```

로컬에서 보내는 인증 메일(가입 확인, 비밀번호 재설정)은 `supabase status`에 나오는 로컬 메일함에서 확인한다.

## 환경변수

| 이름 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable(anon) 키 |

- `.env.local`은 커밋하지 않는다.
- 브라우저에는 URL과 publishable 키만 제공한다. 데이터 접근은 RLS로 제한한다.
- service role 키나 secret 키는 `NEXT_PUBLIC_*` 변수, 코드, 커밋, 로그에 넣지 않는다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 빌드 결과 실행 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript 타입 검사 |
| `pnpm test` | Vitest 단위 테스트 |
| `supabase test db` | DB 권한·RPC pgTAP 테스트 (로컬 Supabase 실행 중일 때) |

## 폴더 구조

```
app/              라우트와 레이아웃 (App Router)
components/ui/    shadcn/ui 컴포넌트
lib/              환경변수, Supabase 클라이언트, 공용 함수
proxy.ts          세션 갱신과 보호 경로 리다이렉트
supabase/         로컬 설정, 마이그레이션, pgTAP 테스트
```

## 데이터와 보안 원칙

- 업무 데이터는 Postgres 테이블에 저장한다. 브라우저 localStorage에는 테마·강조색·밀도 같은 화면 설정만 둔다.
- 모든 업무 테이블은 RLS로 워크스페이스 구성원만 접근하게 한다.
- 파일은 비공개 Storage 버킷에 저장하고 서명 URL로 내려받는다. 파일당 최대 50 MB다.
- 개발용 시드 데이터는 명시적으로 실행할 때만 들어간다. 앱 실행 중 자동으로 생기지 않는다.
- 결제, 청구서, 2단계 인증, 이메일·푸시 알림 발송은 범위 밖이다.

## 데모 로그인

- 데모 로그인은 로컬 전용이다. 배포 환경에는 `DEMO_EMAIL`·`DEMO_PASSWORD` 값을 넣지 않는다.
- 데모 시드 계정(`supabase/seeds/demo.sql`)은 배포 DB에 넣지 않는다.
