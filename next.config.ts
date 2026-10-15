import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 설정 옵션은 여기에 둔다 */
  experimental: {
    // forbidden()과 forbidden.tsx(403 경계)를 쓰려면 켠다
    authInterrupts: true,
  },
  // 모든 응답에 붙이는 보안 헤더. CSP는 프레임 삽입 차단(frame-ancestors)만 둔다.
  // script-src 등 전체 CSP는 Next 인라인 스크립트와 테마 InlineScript를 막을 수 있어 nonce 설계 후에 넣는다
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
