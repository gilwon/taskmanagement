import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 설정 옵션은 여기에 둔다 */
  experimental: {
    // forbidden()과 forbidden.tsx(403 경계)를 쓰려면 켠다
    authInterrupts: true,
  },
};

export default nextConfig;
