# 臺北市大同發展中心｜營運暨評鑑追蹤平台（網站程式）

這個儲存庫只放網站畫面的程式，由 GitHub Pages 免費提供網站。
資料與權限都在 Supabase 資料庫，由資料庫的 Row Level Security 與資料庫函式把關；網頁本身不含任何資料或管理金鑰。

- 上傳到 `main` 分支後，GitHub Actions 會自動建置並更新網站（`.github/workflows/pages.yml`）。
- 需要在 Settings → Secrets and variables → Actions → **Variables** 設定 `SUPABASE_URL` 與 `SUPABASE_ANON_KEY`。
- **不要**在這裡放 service_role（secret）金鑰、員工資料或任何 Excel 檔。
