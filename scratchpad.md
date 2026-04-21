# DoD: Stitch → TransNote UI/UX 전면 전환

## 전제
백엔드 기능(API, 전사, 노트, 번역, 프롬프트 로직 등) 절대 변경 없음.
프론트엔드 레이아웃/스타일만 변경.
.env 파일 절대 안 건드림.

## 1. 레이아웃 구조 전환 (3열 → 2열)
- [x] TwoColumnLayout 컴포넌트 생성
- [x] FixedSidebar(w-64) | MainContent(flex)
- [x] 회의 미선택: 대시보드 (미팅 리스트 풀폭)
- [x] 회의 선택: 결과 뷰어 전체 화면 (뒤로가기로 복귀)
- [x] 모바일: 탭 전환 유지

## 2. 대시보드 (메인 페이지)
- [x] TopAppBar: "Workspace Overview" + 검색 + 알림/설정/아바타
- [x] 히어로 벤토: 그래디언트 CTA(8col) + 스탯(4col)
- [x] 필터 바 + Sort (MeetingList 기존 유지)
- [x] 풀폭 미팅 카드 row
- [ ] 하단 벤토 (차트/프로모 — 데이터 없어서 보류)

## 3. 회의 결과 뷰어
- [x] FINISHED 배지 + 대형 제목(3xl~4xl) + Export 그래디언트 CTA
- [ ] 12-column: col-8(요약) + col-4(Action Items, Topics) — 다음 단계
- [x] 탭: AI Summary / Full Transcript / Original Notes

## 4. 실시간 회의 화면
- [x] TopBar: 로고 + 브레드크럼 + 타이머(펄스) + Stop Meeting
- [x] 2-pane: 다크 전사(2/5) + 노트 에디터(3/5)

## 5. 프롬프트 관리
- [ ] 3-column 카드 그리드 — 다음 단계
- [ ] 12-column 에디터 — 다음 단계

## 6. 설정 페이지
- [x] 완료

## 변경하지 않는 것
- API 호출 로직, WebSocket, NextAuth, Zustand, 백엔드, .env
