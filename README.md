# CBNU FS — 충북대학교 풋살동아리 홈페이지

정적(HTML/CSS/JS) 웹사이트에 **Supabase**를 연결한 버전입니다. 빌드 과정 없이 파일만 올리면 GitHub Pages에서 바로 열리고, 임원진은 사이트의 **임원 관리** 버튼으로 로그인해 내용을 직접 수정할 수 있습니다.

## 구성

| 파일 | 설명 |
| --- | --- |
| `index.html` | 페이지 구조, 임원 관리 패널 마크업 |
| `styles.css` | 디자인 (CBNU 레드 `#B72654` · 골드 `#BE9F56` · 블랙 `#1E1F1F`) |
| `data.js` | **기본값 데이터** — Supabase에 연결되지 않았을 때 쓰는 폴백(선수단·임원·회계·공지·FAQ·연락처) |
| `supabase-config.js` | Supabase Project URL · anon public key |
| `app.js` | 화면 렌더링, Supabase 데이터 로드, 지원서·건의사항 접수, 필터·모달·모바일 메뉴 |
| `admin.js` | 임원 관리 패널 — 아이디/이메일 로그인, 아이디 계정 생성, 매직링크/비밀번호 설정, 임원·선수단·회계·공지·일정·FAQ 수정, 지원서·건의사항 확인 |
| `supabase/schema.sql` | Supabase 테이블 · RLS 정책 · 관리자 판별 함수 (SQL Editor에서 실행) |
| `supabase/seed.json` | `data.js` 기본값을 `site_data`에 넣기 위한 시드 데이터 |
| `favicon.svg`, `assets/` | 브라우저 탭 아이콘, 충북대학교 엠블럼 |

## 데이터 흐름

- **읽기(공개)**: `public.site_data` 의 `settings` · `staff` · `squad` · `finance` · `notices` · `schedules` · `faqs` 행을 모든 방문자가 읽습니다.
  값이 없거나 네트워크 오류면 `data.js` 기본값으로 화면이 그려집니다.
- **쓰기(임원)**: `admin_emails` 에 등록된 이메일로 로그인한 사용자만 `site_data` 를 `upsert` 할 수 있습니다 (RLS).
- **지원서·건의사항**: 누구나 `applications` / `suggestions` 에 `insert` 할 수 있고, **조회·수정·삭제는 관리자만** 가능합니다.

## Supabase 설정 (이미 완료된 상태)

1. Organization `CBNU FS` (Free) → Project `cbnu-fs` (Northeast Asia · Seoul, ref `qpszatipyvbxxharuysm`)
2. SQL Editor에서 `supabase/schema.sql` 실행 → 테이블 4개 + RLS 정책 + 관리자 이메일(`kimjusung1113@gmail.com`) 등록
3. `supabase/seed.json` 을 `site_data` 에 넣어 초기 내용 시드
4. Authentication → URL Configuration
   - Site URL: `https://jusungcokr.github.io/CBNU-FS/`
   - Redirect URLs: `https://jusungcokr.github.io/CBNU-FS/**`
5. Project Settings → API 의 Project URL / anon public key를 `supabase-config.js` 에 넣기 (anon key는 공개되어도 안전하며, 실제 보호는 RLS가 담당)

## 임원 관리 사용법

1. 상단 헤더(모바일은 메뉴 안)의 **임원 관리** 버튼을 누릅니다. 푸터 버튼도 같은 패널을 엽니다.
2. **아이디 또는 이메일**과 비밀번호로 로그인합니다.
   - 아이디만 입력하면(예: `cbnufs`) 내부적으로 `cbnufs@cbnufs.local` 계정으로 로그인합니다.
   - 이메일 계정(`kimjusung1113@gmail.com` 등)은 이메일을 그대로 입력합니다.
   - 처음 이메일 계정은 초대 메일의 링크로 들어와 비밀번호를 설정하고, 잊으면 **비밀번호 재설정 메일**로 다시 설정합니다. (아이디 계정은 메일을 받을 수 없어 비밀번호로만 로그인합니다.)
3. 관리자 이메일이면 대시보드가 열리고, 아래 항목을 직접 고칠 수 있습니다.
   - 기본정보·모토·연락처 / 훈련·회비 안내
   - 임원진 · 선수단 추가·수정·삭제
   - 회계내역 추가·수정·삭제 (이월금·잔액 자동 계산)
   - 공지 · 일정 · FAQ
   - 접수된 지원서·건의사항 목록 및 처리 상태 변경
   - 관리자 이메일 추가·삭제
   - **관리자 탭 → 새 아이디·비밀번호 직접 만들기**: 아이디(영문·숫자·`._-` 2~32자)와 비밀번호(6자 이상)를 정하면 `admin_emails`에 `<아이디>@cbnufs.local`을 등록하고 계정을 즉시 생성합니다(현재 관리자 세션은 유지).
4. 저장하면 `site_data` 에 바로 반영되고 화면도 즉시 갱신됩니다.

## 아이디 로그인 주의

- Supabase Auth → Sign In / Providers → Email 의 **Confirm email** 은 **꺼져 있어야** 합니다. 켜져 있으면 메일함이 없는 `@cbnufs.local` 계정은 인증을 마칠 수 없어 새로 만든 아이디로 로그인되지 않습니다.

## GitHub Pages 배포

1. 저장소(`Jusungcokr/CBNU-FS`) `main` 브랜치 루트에 이 폴더를 올립니다.
2. GitHub 저장소 → **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main** / **/ (root)** → Save
3. `https://jusungcokr.github.io/CBNU-FS/` 로 열립니다.

## 참고

- 폰트는 CDN(Pretendard, Barlow Condensed), Supabase JS는 jsDelivr CDN을 불러옵니다. 오프라인에서는 시스템 폰트와 `data.js` 기본값으로 동작합니다.
- `anon key` 는 클라이언트 공개용입니다. **`service_role` 키는 절대 이 저장소에 넣지 마세요.**
- 엠블럼 이미지는 충북대학교 공식 홈페이지 심볼 페이지의 공식 심볼 PNG를 사용했습니다.
