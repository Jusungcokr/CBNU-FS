# CBNU FS — 충북대학교 풋살동아리 홈페이지

정적(HTML/CSS/JS) 웹사이트입니다. 빌드 과정 없이 파일만 올리면 GitHub Pages에서 바로 열립니다.

## 구성

| 파일 | 설명 |
| --- | --- |
| `index.html` | 페이지 구조와 모든 섹션 |
| `styles.css` | 디자인 (CBNU 레드 `#B72654` · 골드 `#BE9F56` · 블랙 `#1E1F1F`) |
| `data.js` | **선수단·임원·회계·공지·FAQ·연락처 데이터** (여기만 고치면 됩니다) |
| `app.js` | 화면 렌더링, 포지션/회계 필터, 폼, 모달, 모바일 메뉴 |
| `favicon.svg` | 브라우저 탭 아이콘 |

## GitHub Pages 배포

1. 저장소(`Jusungcokr/CBNU-FS`)에 이 폴더의 파일을 `main` 브랜치 루트로 올립니다.
2. GitHub 저장소 → **Settings → Pages** → *Build and deployment*
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더: **/ (root)** → **Save**
3. 1~2분 뒤 아래 주소로 열립니다.
   - `https://jusungcokr.github.io/CBNU-FS/`

이후 수정할 때는 파일을 고쳐 `main`에 다시 올리면 자동으로 반영됩니다.

## 내용 바꾸는 방법

`data.js`만 수정하면 됩니다.

- **임원진** `staff`: `role`(직책), `name`, `dept`(학과·학년), `duty`(역할), `intro`(한 줄 소개)
- **선수단** `squad`: `no`(등번호), `name`, `pos`(`GK` / `FIXO` / `ALA` / `PIVO`), `dept`, `intro`
- **회계** `finance`
  - `openingBalance`: 이월금(원)
  - `transactions`: `{ date, type, category, desc, amount, note }`
    - `type`은 `"income"`(수입) 또는 `"expense"`(지출), `date`는 `YYYY-MM-DD`
    - 금액은 항상 양수로 적습니다. 잔액은 날짜순으로 자동 계산됩니다.
- **공지** `notices`: `tag`는 `모집` / `공지` / `일정`
- **일정** `schedule`: `{ date, day, title, time, place }`
- **FAQ** `faq`: `{ q, a }`
- **연락처·링크** `contact`, `links`: 비어 있으면 버튼이 "준비 중" 안내를 띄웁니다.

### 링크 연결하기

```js
links: {
  googleForm: "https://forms.gle/...",   // 지원서 구글 폼
  openchat: "https://open.kakao.com/o/...", // 카카오톡 오픈채팅
  instagram: "https://instagram.com/..." // 인스타그램
}
```

## 참고

- 현재 선수단·임원·회계·공지 데이터는 **예시**입니다. 실제 명단과 장부로 바꿔 주세요.
- 지원서·건의사항은 정적 사이트라 서버로 전송되지 않습니다. 작성 내용을 요약해 **복사 → 오픈채팅/문자로 전달**하는 방식이며, 구글 폼 링크를 넣으면 폼 접수로 바로 연결됩니다.
- 폰트는 CDN(Pretendard, Barlow Condensed)을 불러옵니다. 오프라인에서는 시스템 폰트로 표시됩니다.
