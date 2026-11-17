/* =========================================================
   CBNU FS — Supabase 연결 설정
   Supabase 대시보드 → Project Settings → API 의 값을 넣습니다.

   - url     : Project URL
   - anonKey : anon public key (클라이언트 공개용)
     이 키는 공개되어도 안전합니다. 실제 쓰기·민감 데이터는
     Supabase RLS(행 수준 보안) 정책으로 막혀 있습니다.
   ========================================================= */

window.CBNU_FS_SUPABASE = {
  url: "https://qpszatipyvbxxharuysm.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwc3phdGlweXZieHhoYXJ1eXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5MTAxOTksImV4cCI6MjExMDQ4NjE5OX0.kb2ffBBqeiZJVpNyDm5KMen1xpPNJtDCq9AxkY07weU"
};
