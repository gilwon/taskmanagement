// 임시 확인 화면. 토큰 색이 테마에 따라 바뀌는지 본다. P2에서 홈 화면으로 교체된다
const swatches = [
  { name: "백로그", color: "var(--st-backlog)" },
  { name: "할 일", color: "var(--st-todo)" },
  { name: "진행 중", color: "var(--st-progress)" },
  { name: "검토", color: "var(--st-review)" },
  { name: "완료", color: "var(--st-done)" },
  { name: "강조색", color: "var(--accent)" },
  { name: "강조색 옅게", color: "var(--accent-soft)" },
];

export default function Home() {
  return (
    <main style={{ padding: "var(--gutter)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600 }}>작업 공간 준비 중</h1>
      <ul className="mt-4 flex flex-wrap gap-3">
        {swatches.map((s) => (
          <li key={s.name} className="flex items-center gap-2" style={{ color: "var(--text-2)" }}>
            <span
              aria-hidden
              className="inline-block size-4"
              style={{ background: s.color, borderRadius: "var(--r-xs)", boxShadow: "var(--shadow-card)" }}
            />
            {s.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
