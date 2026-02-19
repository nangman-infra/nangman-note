# TransNote 프론트엔드 기술 명세서

> 프론트엔드 파트너 인터뷰 기반 UI/UX 설계 및 구현 가이드  
> 작성일: 2026.01.25  
> 버전: 1.0.0

---

## 📋 목차
1. [기술 스택](#1-기술-스택)
2. [UI/UX 설계 원칙](#2-uiux-설계-원칙)
3. [화면 설계](#3-화면-설계)
4. [컴포넌트 아키텍처](#4-컴포넌트-아키텍처)
5. [상태 관리](#5-상태-관리)
6. [API 연동](#6-api-연동)
7. [보안 및 인증](#7-보안-및-인증)
8. [오프라인 지원](#8-오프라인-지원)
9. [성능 최적화](#9-성능-최적화)
10. [개발 우선순위](#10-개발-우선순위)

---

## 1. 기술 스택

### 1.1 확정된 기술 스택

| 카테고리 | 기술 | 버전 | 선택 이유 |
|---------|-----|------|----------|
| **프레임워크** | Next.js | 16.1.3 | App Router, RSC, 최신 기능 |
| **언어** | TypeScript | 5.x | 타입 안전성 |
| **패키지 매니저** | pnpm | 9.x | 빠른 속도, 디스크 효율 |
| **스타일링** | Tailwind CSS | 4.0.x | 유틸리티 우선, 빠른 개발 |
| **UI 라이브러리** | shadcn/ui | 최신 | 접근성, 커스터마이징 |
| **상태 관리** | Zustand | 5.x | 단순함, 보일러플레이트 최소 |
| **폼 관리** | React Hook Form | 7.x | 성능, 검증 |
| **검증** | Zod | 3.x | 타입 안전 스키마 |
| **HTTP 클라이언트** | Axios | 1.x | 인터셉터, 타임아웃 |
| **WebSocket** | Socket.io-client | 4.x | 실시간 통신 |
| **날짜 처리** | date-fns | 4.x | 경량, 트리 쉐이킹 |
| **Markdown** | react-markdown | 9.x | 회의록 렌더링 |
| **PDF 생성** | jsPDF | 2.x | 클라이언트 PDF 생성 |
| **린팅** | ESLint | 9.x | 코드 품질 |
| **포맷팅** | Prettier | 3.x | 일관된 스타일 |


### 1.2 개발 도구

## 개발환경
- **Node.js:** 24.x.x (LTS)
- **Next.js:** 16.1.3 버전 - https://nextjs.org/docs
- **Nginx:** 1.27.x (Mainline) 또는 1.26.x (Stable)
- **패키지 매니저:** pnpm 9.x
- **스타일링:** Tailwind CSS 4.0.x
- **UI 라이브러리:** shadcn/ui
- **ESLint:** v9 이상 버전 - https://eslint.org/docs/latest/
| Vitest | 단위 테스트 |
| React DevTools | 디버깅 |

---

## 2. UI/UX 설계 원칙

### 2.1 핵심 원칙 (인터뷰 기반)

#### 1. 노트 중심 (Note-First)
**원칙**: 사용자는 메모 작성에 집중, 전사는 보조 도구

**참고 사례**: Cleft Notes, Granola, Reflect

**구현**:
- 메인 화면 = 노트 편집기 (Markdown 지원)
- 전사는 접기/펼치기 가능한 패널
- 회의 중 사용자가 직접 작성한 노트가 우선

#### 2. Progressive Disclosure
**원칙**: 필요한 정보만 표시, 복잡도 점진적 증가

**참고 사례**: macOS Print Dialog, Bear Notes

**구현**:
- 고급 설정은 기본적으로 숨김
- "고급 설정" 버튼으로 확장
- 프롬프트 선택은 선택적 (기본값 자동 적용)

#### 3. 미니멀 디자인
**원칙**: 깔끔하고 현대적인 인터페이스

**참고 사례**: Bear Notes, Notion

**구현**:
- 얇은 라인, 넉넉한 여백
- 부드러운 애니메이션
- 불필요한 요소 제거
- Tailwind CSS + shadcn/ui 활용

#### 4. 키보드 중심 인터랙션
**원칙**: 마우스 없이도 빠른 작업 가능

**구현**:
- Enter: 메모 추가
- Shift + Enter: 줄바꿈
- Cmd/Ctrl + K: 검색
- Cmd/Ctrl + N: 새 회의
- Esc: 모달 닫기

### 2.2 접근성 (Accessibility)

| 항목 | 요구사항 |
|-----|----------|
| **키보드 네비게이션** | 모든 기능 키보드로 접근 가능 |
| **스크린 리더** | ARIA 레이블 적용 |
| **색상 대비** | WCAG AA 기준 준수 |
| **포커스 표시** | 명확한 포커스 링 |

---

## 3. 화면 설계

### 3.1 전체 화면 구조 (3-Column Layout)

#### 데스크톱 (1024px 이상)
```
┌─────────────────────────────────────────────────────────────┐
│  TransNote                                    [⚙️] [👤]     │
├──────────┬──────────────────┬───────────────────────────────┤
│          │                  │                               │
│ Sidebar  │  Meeting List    │  Meeting Viewer               │
│ (240px)  │  (320px)         │  (flex-1)                     │
│          │                  │                               │
│ 📂 폴더  │ 🔍 검색...       │  # 회의록 제목                │
│ 📅 오늘  │                  │                               │
│ 📅 최근  │ 오늘             │  [회의록] [전사] [메모]       │
│ 📅 전체  │ • 회의 1         │                               │
│          │   14:00-15:30   │  회의록 내용...               │
│ 🏷️ 태그  │                  │                               │
│ • 회의록 │ 어제             │                               │
│ • 강의   │ • 회의 2         │                               │
│          │   10:30-11:00   │                               │
│ 🗑️ 휴지통│                  │                               │
│          │                  │                               │
│ [+ 새 회의]                 │  [편집] [PDF] [복사]          │
└──────────┴──────────────────┴───────────────────────────────┘
```

#### 모바일 (< 768px)
```
회의 목록 화면 → 회의록 상세 화면 (탭 전환)
```


### 3.2 주요 화면 상세 설계

#### 3.2.1 회의 시작 화면

**목적**: 새 회의 생성 및 시작

**레이아웃**:
```tsx
┌─────────────────────────────────────────┐
│              TransNote                  │
│                                         │
│         실시간 전사 + AI 회의록         │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  회의 제목 (선택)                       │
│  ┌───────────────────────────────────┐ │
│  │ 예: 1분기 마케팅 전략 회의         │ │
│  └───────────────────────────────────┘ │
│                                         │
│                                         │
│           [🎤 회의 시작]               │
│                                         │
│                                         │
│  ⚙️ 고급 설정 (프롬프트 변경)          │  ← 접힌 상태
│                                         │
└─────────────────────────────────────────┘
```

**고급 설정 확장 시**:
```tsx
│  ▲ 고급 설정 숨기기                     │
│  ┌───────────────────────────────────┐ │
│  │ 프롬프트 선택                      │ │
│  │                                    │ │
│  │ ● 회의록 (기본)                   │ │
│  │ ○ 강의                            │ │
│  │ ○ 세미나                          │ │
│  │ ○ 일일 스탠드업 (내 프롬프트)     │ │
│  │                                    │ │
│  │ [+ 새 프롬프트 만들기]            │ │
│  └───────────────────────────────────┘ │
```

**상태**:
- 기본: 제목 입력 + 회의 시작 버튼
- 고급 설정 접힘: Progressive Disclosure 패턴
- 프롬프트 기본값: "회의록"

**인터랙션**:
- 제목 입력 (선택)
- 고급 설정 토글 (클릭)
- 프롬프트 선택 (라디오 버튼)
- 회의 시작 버튼 (클릭 → 회의 진행 화면)

---

#### 3.2.2 회의 진행 화면 (노트 중심)

**목적**: 실시간 전사 + 사용자 메모 작성

**레이아웃**:
```tsx
┌─────────────────────────────────────────┐
│  TransNote                    [⚙️ 설정] │
├─────────────────────────────────────────┤
│  🔴 00:15:30                            │  ← 녹음 중 표시
│                                         │
│  # 2026년 1분기 마케팅 전략 회의       │  ← 제목 (편집 가능)
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ## 안건 1: 신규 제품 런칭             │  ← 사용자가 직접 작성
│                                         │
│  - 타겟: 20-30대                        │
│  - 예산: 5천만원 확정                   │
│  - 런칭일: 3월 1일                      │
│                                         │
│  ## 액션 아이템                         │
│                                         │
│  - [ ] 캠페인 기획서 작성 @김마케팅    │
│  - [ ] 인플루언서 섭외 @이소셜         │
│                                         │
│                                         │
│  ▼ 전사 보기 (15분 30초)               │  ← 접힌 상태 (기본)
│                                         │
├─────────────────────────────────────────┤
│  [회의 종료]                            │
└─────────────────────────────────────────┘
```

**전사 확장 시**:
```tsx
│  ▲ 전사 숨기기                          │
│  ┌───────────────────────────────────┐ │
│  │ 실시간 전사                        │ │
│  │                                    │ │
│  │ [00:15:20] "이번 분기 매출은..."  │ │
│  │ [00:15:25] "20% 증가했습니다"     │ │
│  │ [00:15:28] "다음 분기에는..."     │ │
│  │                                    │ │
│  │ [자동 스크롤 ✓]                   │ │
│  └───────────────────────────────────┘ │
```

**상태**:
- 녹음 중: 타이머 표시
- 노트 편집기: Markdown 지원
- 전사 패널: 기본 접힘, 토글 가능
- 자동 저장: 3초 디바운스

**인터랙션**:
- 노트 작성: 자유 입력 (Markdown)
- 전사 토글: 클릭으로 펼치기/접기
- 설정 버튼: 프롬프트 변경 가능
- 회의 종료: 확인 모달 → AI 생성

---

#### 3.2.3 회의록 결과 화면

**목적**: AI 생성 회의록 확인 및 편집

**레이아웃**:
```tsx
┌─────────────────────────────────────────┐
│  [←] 2026년 1분기 마케팅 전략 회의     │
│  2026-01-25 14:00-15:30                │
│  프롬프트: 회의록                       │
├─────────────────────────────────────────┤
│  [회의록] [전사 원본] [메모]           │  ← 탭 네비게이션
├─────────────────────────────────────────┤
│                                         │
│  # 안건 1: 신규 제품 런칭 전략          │  ← 인라인 편집 가능
│                                         │
│  **논의 요약:**                         │
│  - 타겟 고객층: 20-30대 확정           │
│  - 예산: 5천만원                        │
│  - 런칭일: 3월 1일                      │
│                                         │
│  **결정사항:**                          │
│  - 3월 1일 공식 런칭 결정됨            │
│                                         │
│  **액션 아이템:**                       │
│  | 작업 | 담당자 | 마감일 | 우선순위 | │
│  |------|--------|--------|----------|  │
│  | 기획서 | 김마케팅 | 02-01 | High |  │
│                                         │
├─────────────────────────────────────────┤
│  [편집 모드] [PDF 다운로드] [복사]     │
│  [프롬프트 변경 후 재생성]              │  ← 버전 관리
└─────────────────────────────────────────┘
```

**상태**:
- 탭: 회의록 / 전사 원본 / 메모
- 편집 모드: 인라인 편집 (Markdown)
- 버전: 프롬프트 변경 시 재생성 가능

**인터랙션**:
- 탭 전환: 클릭
- 편집: 인라인 편집 (contentEditable)
- PDF 다운로드: jsPDF 생성
- 복사: 클립보드 복사
- 재생성: 프롬프트 선택 → AI 재생성


#### 3.2.4 회의 목록 화면 (3-Column Layout)

**목적**: 과거 회의 검색 및 조회

**데스크톱 레이아웃**:
```tsx
┌──────────┬──────────────────┬───────────────────────────────┐
│ Sidebar  │  Meeting List    │  Meeting Viewer               │
├──────────┼──────────────────┼───────────────────────────────┤
│          │                  │                               │
│ 📂 폴더  │ 🔍 검색...       │  # 회의록 제목                │
│          │                  │                               │
│ 📅 오늘  │ [날짜▼] [태그▼] │  [회의록] [전사] [메모]       │
│ 📅 최근  │                  │                               │
│ 📅 전체  │ 오늘 (2)         │  회의록 내용...               │
│          │ ┌──────────────┐ │                               │
│ 🏷️ 태그  │ │ 1분기 마케팅 │ │                               │
│ • 회의록 │ │ 14:00-15:30  │ │                               │
│ • 강의   │ │ 회의록       │ │                               │
│ • 세미나 │ └──────────────┘ │                               │
│          │                  │                               │
│ 🗑️ 휴지통│ ┌──────────────┐ │                               │
│          │ │ 제품 기획    │ │                               │
│ [+ 새 회의]│ 10:30-11:00  │ │                               │
│          │ │ 회의록       │ │                               │
│          │ └──────────────┘ │                               │
└──────────┴──────────────────┴───────────────────────────────┘
```

**모바일 레이아웃**:
```tsx
// 회의 목록 화면
┌─────────────────────────────────┐
│  TransNote          [+ 새 회의] │
├─────────────────────────────────┤
│  🔍 검색...                     │
│                                  │
│  [오늘] [최근] [전체]           │
│                                  │
│  오늘 (2)                        │
│  ┌───────────────────────────┐  │
│  │ 1분기 마케팅 전략 회의    │  │
│  │ 14:00-15:30               │  │
│  │ 회의록 프롬프트           │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │ 제품 기획 회의            │  │
│  │ 10:30-11:00               │  │
│  │ 회의록 프롬프트           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘

// 회의록 상세 화면 (탭하면 이동)
┌─────────────────────────────────┐
│  [←] 1분기 마케팅 전략 회의     │
├─────────────────────────────────┤
│  [회의록] [전사] [메모]         │
├─────────────────────────────────┤
│  # 안건 1: 신규 제품 런칭       │
│  ...                             │
│                                  │
│  [편집] [공유] [PDF]            │
└─────────────────────────────────┘
```

**기능**:
- Full-Text Search: 제목 + 회의록 + 전사 + 메모
- 필터: 날짜 범위, 프롬프트 타입
- 정렬: 최신순, 오래된 순
- 휴지통: 30일 보관 후 자동 삭제

---

## 4. 컴포넌트 아키텍처

### 4.1 폴더 구조 (Feature-Based)

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   ├── page.tsx                  # 홈 (회의 목록)
│   │   ├── meeting/
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # 회의 시작
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx          # 회의 진행
│   │   │   │   └── result/
│   │   │   │       └── page.tsx      # 회의록 결과
│   │   │   └── layout.tsx
│   │   └── settings/
│   │       └── page.tsx              # 설정
│   │
│   ├── domains/                      # 도메인별 구조
│   │   ├── meeting/
│   │   │   ├── components/
│   │   │   │   ├── MeetingCard.tsx
│   │   │   │   ├── MeetingList.tsx
│   │   │   │   └── MeetingViewer.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMeeting.ts
│   │   │   │   └── useMeetings.ts
│   │   │   ├── stores/
│   │   │   │   └── meetingStore.ts
│   │   │   ├── types/
│   │   │   │   └── meeting.types.ts
│   │   │   └── api/
│   │   │       └── meetingApi.ts
│   │   │
│   │   ├── transcription/
│   │   │   ├── components/
│   │   │   │   ├── TranscriptPanel.tsx
│   │   │   │   └── TranscriptSegment.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useTranscription.ts
│   │   │   └── stores/
│   │   │       └── transcriptionStore.ts
│   │   │
│   │   ├── note/
│   │   │   ├── components/
│   │   │   │   └── NoteEditor.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useNote.ts
│   │   │   └── stores/
│   │   │       └── noteStore.ts
│   │   │
│   │   ├── prompt/
│   │   │   ├── components/
│   │   │   │   ├── PromptSelector.tsx
│   │   │   │   └── PromptManager.tsx
│   │   │   ├── hooks/
│   │   │   │   └── usePrompt.ts
│   │   │   └── stores/
│   │   │       └── promptStore.ts
│   │   │
│   │   └── result/
│   │       ├── components/
│   │       │   ├── ResultViewer.tsx
│   │       │   └── ResultEditor.tsx
│   │       ├── hooks/
│   │       │   └── useResult.ts
│   │       └── stores/
│   │           └── resultStore.ts
│   │
│   ├── components/                   # 공통 컴포넌트
│   │   ├── ui/                       # shadcn/ui
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── ThreeColumnLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── common/
│   │       ├── SearchBar.tsx
│   │       └── LoadingSpinner.tsx
│   │
│   ├── lib/                          # 유틸리티
│   │   ├── api/
│   │   │   ├── client.ts             # Axios 인스턴스
│   │   │   └── websocket.ts          # Socket.io 클라이언트
│   │   ├── utils/
│   │   │   ├── date.ts
│   │   │   ├── markdown.ts
│   │   │   └── pdf.ts
│   │   └── constants/
│   │       └── index.ts
│   │
│   ├── hooks/                        # 공통 훅
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── useMediaQuery.ts
│   │
│   └── styles/
│       └── globals.css               # Tailwind CSS
│
├── public/
│   └── icons/
│
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```


### 4.2 핵심 컴포넌트 설계

#### 4.2.1 ThreeColumnLayout

```tsx
// components/layout/ThreeColumnLayout.tsx
interface ThreeColumnLayoutProps {
  sidebar: React.ReactNode;
  list: React.ReactNode;
  viewer: React.ReactNode;
}

export function ThreeColumnLayout({ sidebar, list, viewer }: ThreeColumnLayoutProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [activeColumn, setActiveColumn] = useState<"list" | "viewer">("list");

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col">
        {activeColumn === "list" ? list : viewer}
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <aside className="w-60 border-r">{sidebar}</aside>
      <div className="w-80 border-r">{list}</div>
      <main className="flex-1">{viewer}</main>
    </div>
  );
}
```

#### 4.2.2 NoteEditor (노트 중심 편집기)

```tsx
// domains/note/components/NoteEditor.tsx
interface NoteEditorProps {
  meetingId: string;
  initialContent?: string;
  onSave?: (content: string) => void;
}

export function NoteEditor({ meetingId, initialContent, onSave }: NoteEditorProps) {
  const [content, setContent] = useState(initialContent || "");
  const debouncedContent = useDebounce(content, 3000);

  // 자동 저장
  useEffect(() => {
    if (debouncedContent && onSave) {
      onSave(debouncedContent);
    }
  }, [debouncedContent, onSave]);

  return (
    <div className="h-full flex flex-col">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="회의 내용을 자유롭게 작성하세요... (Markdown 지원)"
        className="flex-1 p-4 resize-none focus:outline-none font-mono"
      />
    </div>
  );
}
```

#### 4.2.3 TranscriptPanel (확장 가능한 전사 패널)

```tsx
// domains/transcription/components/TranscriptPanel.tsx
interface TranscriptPanelProps {
  meetingId: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function TranscriptPanel({ meetingId, collapsed = true, onToggle }: TranscriptPanelProps) {
  const { transcripts } = useTranscription(meetingId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="border-t">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="text-sm font-medium">
          {collapsed ? "▼" : "▲"} 전사 보기 ({formatDuration(transcripts.length)})
        </span>
      </button>

      {!collapsed && (
        <div ref={scrollRef} className="h-64 overflow-y-auto p-4 bg-gray-50">
          {transcripts.map((segment) => (
            <div key={segment.id} className="mb-2">
              <span className="text-xs text-gray-500">[{formatTime(segment.startTime)}]</span>
              <span className="ml-2">{segment.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 4.2.4 PromptSelector (Progressive Disclosure)

```tsx
// domains/prompt/components/PromptSelector.tsx
interface PromptSelectorProps {
  selectedId?: string;
  onChange?: (promptId: string) => void;
}

export function PromptSelector({ selectedId, onChange }: PromptSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const { prompts } = usePrompts();

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
      >
        <Settings className="w-4 h-4" />
        {expanded ? "고급 설정 숨기기" : "고급 설정"}
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-3 p-4 border rounded-lg bg-gray-50"
        >
          <label className="block text-sm font-medium mb-2">프롬프트 선택</label>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <label key={prompt.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="prompt"
                  value={prompt.id}
                  checked={selectedId === prompt.id}
                  onChange={() => onChange?.(prompt.id)}
                />
                <span>{prompt.name}</span>
                {prompt.isDefault && <span className="text-xs text-gray-500">(기본)</span>}
              </label>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

---

## 5. 상태 관리

### 5.1 Zustand Store 설계

#### 5.1.1 Meeting Store

```typescript
// domains/meeting/stores/meetingStore.ts
interface MeetingState {
  // 현재 회의
  currentMeeting: Meeting | null;
  isRecording: boolean;
  elapsedTime: number;

  // 회의 목록
  meetings: Meeting[];
  isLoading: boolean;
  error: string | null;

  // Actions
  startMeeting: (dto: CreateMeetingDto) => Promise<void>;
  endMeeting: () => Promise<void>;
  updatePrompt: (promptId: string) => Promise<void>;
  fetchMeetings: () => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  currentMeeting: null,
  isRecording: false,
  elapsedTime: 0,
  meetings: [],
  isLoading: false,
  error: null,

  startMeeting: async (dto) => {
    try {
      const meeting = await meetingApi.create(dto);
      set({ currentMeeting: meeting, isRecording: true });
    } catch (error) {
      set({ error: error.message });
    }
  },

  endMeeting: async () => {
    const { currentMeeting } = get();
    if (!currentMeeting) return;

    try {
      await meetingApi.complete(currentMeeting.id);
      set({ isRecording: false });
    } catch (error) {
      set({ error: error.message });
    }
  },

  updatePrompt: async (promptId) => {
    const { currentMeeting } = get();
    if (!currentMeeting) return;

    try {
      const updated = await meetingApi.updatePrompt(currentMeeting.id, promptId);
      set({ currentMeeting: updated });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchMeetings: async () => {
    set({ isLoading: true });
    try {
      const meetings = await meetingApi.list();
      set({ meetings, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteMeeting: async (id) => {
    try {
      await meetingApi.delete(id);
      set((state) => ({
        meetings: state.meetings.filter((m) => m.id !== id),
      }));
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
```

#### 5.1.2 Note Store

```typescript
// domains/note/stores/noteStore.ts
interface NoteState {
  noteContent: string;
  isSaving: boolean;
  lastSaved: Date | null;

  // Actions
  setContent: (content: string) => void;
  saveNote: (meetingId: string) => Promise<void>;
  loadNote: (meetingId: string) => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  noteContent: "",
  isSaving: false,
  lastSaved: null,

  setContent: (content) => {
    set({ noteContent: content });
  },

  saveNote: async (meetingId) => {
    const { noteContent } = get();
    set({ isSaving: true });

    try {
      await noteApi.save(meetingId, noteContent);
      set({ isSaving: false, lastSaved: new Date() });
    } catch (error) {
      set({ isSaving: false });
      console.error('Failed to save note:', error);
    }
  },

  loadNote: async (meetingId) => {
    try {
      const note = await noteApi.get(meetingId);
      set({ noteContent: note.content });
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  },
}));
```

```typescript
// domains/transcription/stores/transcriptionStore.ts
interface TranscriptionState {
  transcripts: TranscriptSegment[];
  isConnected: boolean;
  isTranscriptExpanded: boolean;

  // Actions
  connect: (meetingId: string) => void;
  disconnect: () => void;
  addSegment: (segment: TranscriptSegment) => void;
  toggleExpanded: () => void;
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
  transcripts: [],
  isConnected: false,
  isTranscriptExpanded: false,

  connect: (meetingId) => {
    // WebSocket 연결 로직
    set({ isConnected: true });
  },

  disconnect: () => {
    // WebSocket 연결 해제
    set({ isConnected: false, transcripts: [] });
  },

  addSegment: (segment) => {
    set((state) => ({
      transcripts: [...state.transcripts, segment],
    }));
  },

  toggleExpanded: () => {
    set((state) => ({
      isTranscriptExpanded: !state.isTranscriptExpanded,
    }));
  },
}));
```


### 5.2 로컬 스토리지 (오프라인 지원)

```typescript
// hooks/useLocalStorage.ts
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
```

---

## 6. API 연동

### 6.1 Axios 클라이언트 설정

```typescript
// lib/api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    // 추후 인증 토큰 추가
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => response.data, // { success: true, data: ... }
  (error) => {
    const message = error.response?.data?.error?.message || '오류가 발생했습니다';
    return Promise.reject(new Error(message));
  }
);
```

### 6.2 API 함수 (예시: Meeting)

```typescript
// domains/meeting/api/meetingApi.ts
import { apiClient } from '@/lib/api/client';
import type { Meeting, CreateMeetingDto } from '../types/meeting.types';

export const meetingApi = {
  // 회의 생성
  create: async (dto: CreateMeetingDto): Promise<Meeting> => {
    const response = await apiClient.post<{ data: Meeting }>('/api/v1/meetings', dto);
    return response.data;
  },

  // 회의 목록 조회
  list: async (params?: { page?: number; limit?: number }): Promise<Meeting[]> => {
    const response = await apiClient.get<{ data: { meetings: Meeting[] } }>(
      '/api/v1/meetings',
      { params }
    );
    return response.data.meetings;
  },

  // 회의 검색
  search: async (query: string, scope: string = 'all'): Promise<SearchResult[]> => {
    const response = await apiClient.get<{ data: { results: SearchResult[] } }>(
      '/api/v1/meetings/search',
      { params: { q: query, scope } }
    );
    return response.data.results;
  },

  // 회의 상세 조회
  get: async (id: string): Promise<Meeting> => {
    const response = await apiClient.get<{ data: Meeting }>(`/api/v1/meetings/${id}`);
    return response.data;
  },

  // 프롬프트 변경
  updatePrompt: async (id: string, promptId: string): Promise<Meeting> => {
    const response = await apiClient.patch<{ data: Meeting }>(
      `/api/v1/meetings/${id}`,
      { promptId }
    );
    return response.data;
  },

  // 회의 종료
  complete: async (id: string): Promise<Meeting> => {
    const response = await apiClient.post<{ data: Meeting }>(
      `/api/v1/meetings/${id}/complete`
    );
    return response.data;
  },

  // 회의 삭제
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/meetings/${id}`);
  },
};
```

### 6.3 WebSocket 연결 (실시간 전사)

```typescript
// lib/api/websocket.ts
import { io, Socket } from 'socket.io-client';

export class TranscriptionSocket {
  private socket: Socket | null = null;

  connect(meetingId: string) {
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      path: '/ws/transcribe',
      query: { meetingId },
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return this.socket;
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.socket) {
      this.socket.emit('audio', audioData);
    }
  }

  onTranscript(callback: (segment: TranscriptSegment) => void) {
    if (this.socket) {
      this.socket.on('transcript', callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
```

### 6.4 Note API

```typescript
// domains/note/api/noteApi.ts
import { apiClient } from '@/lib/api/client';
import type { Note } from '../types/note.types';

export const noteApi = {
  // 노트 저장 (자동 저장)
  save: async (meetingId: string, content: string): Promise<Note> => {
    const response = await apiClient.put<{ data: Note }>(
      `/api/v1/meetings/${meetingId}/note`,
      { content }
    );
    return response.data;
  },

  // 노트 조회
  get: async (meetingId: string): Promise<Note> => {
    const response = await apiClient.get<{ data: Note }>(
      `/api/v1/meetings/${meetingId}/note`
    );
    return response.data;
  },
};
```

### 6.5 Result API

```typescript
// domains/result/api/resultApi.ts
import { apiClient } from '@/lib/api/client';
import type { MeetingResult } from '../types/result.types';

export const resultApi = {
  // 회의록 조회
  get: async (meetingId: string): Promise<MeetingResult> => {
    const response = await apiClient.get<{ data: MeetingResult }>(
      `/api/v1/meetings/${meetingId}/result`
    );
    return response.data;
  },

  // 회의록 편집
  update: async (meetingId: string, content: string): Promise<MeetingResult> => {
    const response = await apiClient.patch<{ data: MeetingResult }>(
      `/api/v1/meetings/${meetingId}/result`,
      { content }
    );
    return response.data;
  },

  // 회의록 재생성 (프롬프트 변경)
  regenerate: async (meetingId: string, promptId: string): Promise<MeetingResult> => {
    const response = await apiClient.post<{ data: MeetingResult }>(
      `/api/v1/meetings/${meetingId}/result/regenerate`,
      { promptId }
    );
    return response.data;
  },

  // PDF 다운로드
  exportPDF: async (meetingId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/api/v1/meetings/${meetingId}/result/export?format=pdf`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};
```

### 6.6 React Query (선택적)

```typescript
// domains/meeting/hooks/useMeeting.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingApi } from '../api/meetingApi';

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: () => meetingApi.list(),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meeting', id],
    queryFn: () => meetingApi.get(id),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: meetingApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}
```

---

## 7. 보안 및 인증

### 7.1 인증 (Phase 2)

**방식**: Passwordless (이메일 매직 링크 또는 OTP)

**구현 계획**:
```typescript
// lib/auth/authService.ts (Phase 2)
export const authService = {
  // 이메일로 매직 링크 전송
  sendMagicLink: async (email: string) => {
    await apiClient.post('/api/v1/auth/magic-link', { email });
  },

  // 매직 링크 토큰 검증
  verifyMagicLink: async (token: string) => {
    const response = await apiClient.post('/api/v1/auth/verify', { token });
    return response.data.accessToken;
  },

  // 토큰 저장
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
  },

  // 토큰 조회
  getToken: () => {
    return localStorage.getItem('auth_token');
  },

  // 로그아웃
  logout: () => {
    localStorage.removeItem('auth_token');
  },
};
```

### 7.2 세션 관리 (업계 BP)

**원칙**: 사용자 UX를 방해하지 않는 세션 관리

**구현**:
- JWT 토큰 기반
- 자동 갱신 (Refresh Token)
- 30일 로그인 유지 (Remember Me)
- 다중 디바이스 동시 로그인 지원

```typescript
// lib/auth/sessionManager.ts (Phase 2)
export class SessionManager {
  private refreshTimer: NodeJS.Timeout | null = null;

  // 자동 토큰 갱신
  startAutoRefresh() {
    this.refreshTimer = setInterval(async () => {
      try {
        const newToken = await authService.refreshToken();
        authService.setToken(newToken);
      } catch (error) {
        // 갱신 실패 시 로그아웃
        authService.logout();
        window.location.href = '/login';
      }
    }, 15 * 60 * 1000); // 15분마다
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}
```

### 7.3 HTTPS Only

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};
```

---

## 8. 오프라인 지원

### 8.1 Service Worker (PWA)

```typescript
// public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('transnote-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/meeting/new',
        '/styles/globals.css',
        // 필수 리소스
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### 8.2 IndexedDB (로컬 데이터 저장)

```typescript
// lib/db/indexedDB.ts
import { openDB, DBSchema } from 'idb';

interface TransNoteDB extends DBSchema {
  meetings: {
    key: string;
    value: Meeting;
    indexes: { 'by-date': Date };
  };
  transcripts: {
    key: string;
    value: TranscriptSegment;
    indexes: { 'by-meeting': string };
  };
  memos: {
    key: string;
    value: Memo;
    indexes: { 'by-meeting': string };
  };
}

export const db = await openDB<TransNoteDB>('transnote', 1, {
  upgrade(db) {
    // Meetings
    const meetingStore = db.createObjectStore('meetings', { keyPath: 'id' });
    meetingStore.createIndex('by-date', 'createdAt');

    // Transcripts
    const transcriptStore = db.createObjectStore('transcripts', { keyPath: 'id' });
    transcriptStore.createIndex('by-meeting', 'meetingId');

    // Memos
    const memoStore = db.createObjectStore('memos', { keyPath: 'id' });
    memoStore.createIndex('by-meeting', 'meetingId');
  },
});

// 사용 예시
export const offlineStorage = {
  saveMeeting: async (meeting: Meeting) => {
    await db.put('meetings', meeting);
  },

  getMeeting: async (id: string) => {
    return await db.get('meetings', id);
  },

  getAllMeetings: async () => {
    return await db.getAll('meetings');
  },
};
```

### 8.3 동기화 전략

```typescript
// lib/sync/syncManager.ts
export class SyncManager {
  async syncWhenOnline() {
    if (!navigator.onLine) return;

    // IndexedDB에서 동기화 안 된 데이터 조회
    const unsyncedMeetings = await this.getUnsyncedMeetings();

    for (const meeting of unsyncedMeetings) {
      try {
        await meetingApi.create(meeting);
        await this.markAsSynced(meeting.id);
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }

  private async getUnsyncedMeetings() {
    // 로컬에만 있고 서버에 없는 회의 조회
    return [];
  }

  private async markAsSynced(id: string) {
    // 동기화 완료 표시
  }
}
```


---

## 9. 성능 최적화

### 9.1 코드 스플리팅

```typescript
// app/meeting/[id]/page.tsx
import dynamic from 'next/dynamic';

// 무거운 컴포넌트는 동적 로딩
const NoteEditor = dynamic(() => import('@/domains/memo/components/NoteEditor'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});

const TranscriptPanel = dynamic(
  () => import('@/domains/transcription/components/TranscriptPanel'),
  { ssr: false }
);
```

### 9.2 이미지 최적화

```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="TransNote"
  width={120}
  height={40}
  priority // LCP 최적화
/>
```

### 9.3 메모이제이션

```typescript
// domains/meeting/components/MeetingList.tsx
import { memo } from 'react';

export const MeetingCard = memo(({ meeting }: { meeting: Meeting }) => {
  return (
    <div className="p-4 border rounded-lg">
      <h3>{meeting.title}</h3>
      <p>{formatDate(meeting.startedAt)}</p>
    </div>
  );
});

MeetingCard.displayName = 'MeetingCard';
```

### 9.4 가상 스크롤 (긴 목록)

```typescript
// domains/transcription/components/TranscriptPanel.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function TranscriptPanel({ transcripts }: { transcripts: TranscriptSegment[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transcripts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} className="h-64 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {transcripts[virtualItem.index].text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 9.5 Debounce (자동 저장)

```typescript
// hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

---

## 10. 개발 우선순위

### 10.1 Phase 1: MVP (4주)

#### Week 1: 프로젝트 초기화 및 기본 UI
- [ ] Next.js 16 프로젝트 생성
- [ ] Tailwind CSS 4.0 + shadcn/ui 설정
- [ ] 폴더 구조 및 라우팅 설정
- [ ] 공통 컴포넌트 (Button, Input, Dialog)
- [ ] ThreeColumnLayout 구현
- [ ] 반응형 레이아웃 (모바일/데스크톱)

**산출물**:
- `frontend/` 프로젝트 초기화
- 기본 레이아웃 컴포넌트
- 반응형 확인

#### Week 2: 회의 시작 및 진행 화면
- [ ] 회의 시작 화면 UI
- [ ] PromptSelector (Progressive Disclosure)
- [ ] NoteEditor (Markdown 지원)
- [ ] TranscriptPanel (접기/펼치기)
- [ ] WebSocket 연결 (실시간 전사)
- [ ] 자동 저장 (Debounce)

**산출물**:
- 회의 시작 플로우
- 노트 중심 편집기
- 실시간 전사 표시

#### Week 3: 회의록 결과 및 편집
- [ ] 회의록 결과 화면 UI
- [ ] 탭 네비게이션 (회의록/전사/메모)
- [ ] 인라인 편집 (contentEditable)
- [ ] PDF 다운로드 (jsPDF)
- [ ] 복사 기능 (Clipboard API)
- [ ] 프롬프트 변경 후 재생성

**산출물**:
- 회의록 뷰어
- 편집 기능
- 내보내기 기능

#### Week 4: 회의 목록 및 검색
- [ ] 회의 목록 화면 (3-Column)
- [ ] Sidebar (폴더, 태그, 휴지통)
- [ ] SearchBar (Full-Text Search)
- [ ] 필터 (날짜, 프롬프트)
- [ ] 정렬 (최신순, 오래된 순)
- [ ] 휴지통 (30일 보관)

**산출물**:
- 회의 목록 및 검색
- 필터링 및 정렬
- 휴지통 기능

### 10.2 Phase 2: 고도화 (3주)

#### Week 5-6: 오프라인 지원 및 성능 최적화
- [ ] Service Worker (PWA)
- [ ] IndexedDB (로컬 저장)
- [ ] 동기화 전략
- [ ] 코드 스플리팅
- [ ] 가상 스크롤
- [ ] 이미지 최적화

#### Week 7: 인증 시스템
- [ ] Passwordless 인증 UI
- [ ] 이메일 매직 링크
- [ ] 세션 관리
- [ ] 자동 토큰 갱신

### 10.3 Phase 3: 프로덕션 준비 (2주)

#### Week 8: 테스트 및 접근성
- [ ] 단위 테스트 (Vitest)
- [ ] E2E 테스트 (Playwright)
- [ ] 접근성 검증 (axe-core)
- [ ] 성능 테스트 (Lighthouse)

#### Week 9: 배포 준비
- [ ] 환경변수 설정
- [ ] Docker 이미지 빌드
- [ ] CI/CD 파이프라인
- [ ] 모니터링 (Sentry)

---

## 11. 백엔드 API 요구사항 (추가 필요)

### 11.1 회의록 편집 API

**현재 상태**: 백엔드 문서에 명시 없음

**필요 API**:
```http
PATCH /api/v1/meetings/{meetingId}/result
Content-Type: application/json

{
  "content": "# 수정된 회의록 내용..."
}

Response 200:
{
  "success": true,
  "data": {
    "id": "result_001",
    "content": "# 수정된 회의록 내용...",
    "updatedAt": "2026-01-25T16:00:00Z"
  }
}
```

### 11.2 회의록 버전 관리

**현재 상태**: MeetingResult는 1:1 관계

**제안**:
- 옵션 A: MeetingResult를 1:N 관계로 변경 (버전 히스토리)
- 옵션 B: 재생성 시 기존 결과 덮어쓰기 (단순)

**프론트엔드 선호**: 옵션 B (단순함, MVP에 적합)

### 11.3 검색 API

**필요 API**:
```http
GET /api/v1/meetings/search?q=예산&scope=all

Response 200:
{
  "success": true,
  "data": {
    "results": [
      {
        "meetingId": "meeting_001",
        "title": "1분기 마케팅 전략 회의",
        "matchedIn": "result", // "title" | "result" | "transcript" | "memo"
        "snippet": "...예산: 5천만원 확정...",
        "createdAt": "2026-01-25T14:00:00Z"
      }
    ]
  }
}
```

---

## 12. 환경변수

```bash
# .env.example
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_APP_NAME=TransNote
NEXT_PUBLIC_APP_VERSION=1.0.0
```

---

## 13. 참고 문서

- [Next.js 16 문서](https://nextjs.org/docs)
- [Tailwind CSS 4.0](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [React Hook Form](https://react-hook-form.com/)
- [Socket.io Client](https://socket.io/docs/v4/client-api/)

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|-----|------|--------|----------|
| 1.1.0 | 2026-01-25 | AI Assistant | 백엔드 일원화: Note API, Result 편집/재생성 API, 검색 API 추가 |
| 1.0.0 | 2026-01-25 | AI Assistant | 초안 작성 (프론트엔드 인터뷰 + 백엔드 문서 기반) |

---

**문서 끝**
