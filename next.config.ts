import type { NextConfig } from 'next';

// 純網頁版（GitHub Pages）：npm run build 會在 out/ 產生靜態網站，整個資料夾上傳即可。
// NEXT_PUBLIC_BASE_PATH：網站子路徑，例如放在 https://tpta104.github.io/datong-platform/ 就填 /datong-platform
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const config: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,          // GitHub Pages 以資料夾的 index.html 提供每一頁
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default config;
