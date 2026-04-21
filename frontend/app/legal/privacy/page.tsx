import type { Metadata } from 'next';
import {
  LegalDocumentLayout,
  type LegalDocumentSection,
} from '../_components/LegalDocumentLayout';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description: 'TransNote 개인정보 처리방침',
  alternates: {
    canonical: '/legal/privacy',
  },
};

const EFFECTIVE_DATE = '2026년 4월 21일';

const privacySections: LegalDocumentSection[] = [
  {
    id: 'overview',
    title: '기본 원칙',
    children: (
      <>
        <p>
          낭만 인프라는 TransNote 제공에 필요한 최소 범위의 개인정보와 서비스
          데이터를 처리합니다. 회원가입을 위해 이름과 비밀번호를 직접 받지
          않으며, 이메일 기반 로그인은 이메일 주소만 직접 입력받습니다.
        </p>
        <p>
          다만 회의 제목, 음성, 전사문, 노트, 프롬프트, AI 생성 결과물에는
          사용자가 입력하거나 녹음한 내용에 따라 개인정보가 포함될 수 있습니다.
        </p>
      </>
    ),
  },
  {
    id: 'collected-items',
    title: '처리하는 항목',
    children: (
      <div className="overflow-hidden rounded-2xl border border-[var(--line-soft)]">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead className="bg-[var(--surface-container-low)] text-[var(--ink-strong)]">
            <tr>
              <th className="px-4 py-3 font-bold">구분</th>
              <th className="px-4 py-3 font-bold">처리 항목</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line-soft)]">
            <tr>
              <td className="px-4 py-3 font-semibold text-[var(--ink-strong)]">
                로그인
              </td>
              <td className="px-4 py-3">
                이메일 주소, 로그인 링크 발송·검증 정보, 세션 정보
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-[var(--ink-strong)]">
                조직 계정 로그인
              </td>
              <td className="px-4 py-3">
                인증 제공자가 전달하는 사용자 식별자, 이메일, 프로필 정보,
                접근 토큰과 갱신 토큰
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-[var(--ink-strong)]">
                회의 기록
              </td>
              <td className="px-4 py-3">
                회의 제목, 안건, 생성·수정 시각, 상태, 오디오, 전사문, 번역문,
                발화자 정보, 회의 길이
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-[var(--ink-strong)]">
                작업 결과
              </td>
              <td className="px-4 py-3">
                노트, 프롬프트 이름·내용, 문서 유형, AI 생성 결과물, 내보내기
                파일 생성에 필요한 정보
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-[var(--ink-strong)]">
                서비스 운영
              </td>
              <td className="px-4 py-3">
                접속 로그, 오류 로그, 기기·브라우저 정보, 네트워크 정보, 보안
                이벤트
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'purpose',
    title: '처리 목적',
    children: (
      <ul className="list-disc space-y-2 pl-5">
        <li>이메일 매직 링크 발송, 로그인 처리, 계정 식별</li>
        <li>회의 생성, 회의 아카이브, 휴지통, 복원과 삭제 기능 제공</li>
        <li>실시간 전사, 음성 업로드, 번역 보조, 노트 편집 기능 제공</li>
        <li>프롬프트 기반 AI 결과물 생성, 결과물 재생성, 파일 내보내기 제공</li>
        <li>서비스 장애 대응, 보안 점검, 부정 이용 방지, 품질 개선</li>
      </ul>
    ),
  },
  {
    id: 'retention',
    title: '보유 및 삭제',
    children: (
      <>
        <p>
          로그인 식별 정보는 계정이 유지되는 동안 보관하며, 계정 삭제나 서비스
          이용 종료 요청이 처리되면 관련 법령과 운영상 필요한 범위를 제외하고
          삭제합니다.
        </p>
        <p>
          회의 기록, 노트, 프롬프트, AI 결과물은 사용자가 서비스에서 삭제하거나
          운영상 보관 목적이 달성될 때까지 보관됩니다. 휴지통으로 이동된 회의는
          복원 또는 영구 삭제 처리가 가능하며, 영구 삭제 후에는 서비스 화면에서
          더 이상 이용할 수 없습니다.
        </p>
        <p>
          보안 로그, 오류 로그, 백업 데이터는 장애 대응, 보안 감사, 데이터 복구
          목적을 위해 필요한 기간 동안 별도로 보관될 수 있습니다.
        </p>
      </>
    ),
  },
  {
    id: 'third-party',
    title: '외부 처리와 제공',
    children: (
      <>
        <p>
          TransNote는 인증, 이메일 발송, 저장소, 음성 전사, AI 결과물 생성을
          위해 외부 시스템이나 처리 제공자를 사용할 수 있습니다. 이 경우 필요한
          범위의 데이터만 전달되며, 서비스 제공 목적 외 사용을 제한하는 방식으로
          관리합니다.
        </p>
        <p>
          법령에 근거가 있거나 사용자의 별도 동의가 있는 경우를 제외하고,
          TransNote는 사용자의 개인정보를 서비스 제공 목적 밖으로 임의 제공하지
          않습니다.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: '사용자의 권리',
    children: (
      <p>
        사용자는 본인의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요청할 수
        있습니다. 회의 콘텐츠 삭제는 서비스 화면의 삭제 기능을 통해 직접 처리할
        수 있으며, 계정이나 접근 권한 관련 요청은 TransNote 서비스 운영자 또는
        낭만 인프라 관리자에게 문의할 수 있습니다.
      </p>
    ),
  },
  {
    id: 'security',
    title: '안전성 확보 조치',
    children: (
      <ul className="list-disc space-y-2 pl-5">
        <li>인증 세션과 접근 권한을 기반으로 한 서비스 접근 제어</li>
        <li>운영 환경에서의 암호화 통신과 토큰 기반 인증 처리</li>
        <li>오류·보안 로그 점검을 통한 이상 징후 확인</li>
        <li>필요 인원 중심의 운영 접근 권한 관리</li>
      </ul>
    ),
  },
  {
    id: 'children',
    title: '아동의 개인정보',
    children: (
      <p>
        TransNote는 회의 기록 업무를 위한 서비스이며, 만 14세 미만 아동을
        대상으로 계정을 직접 생성하거나 서비스를 제공하지 않습니다.
      </p>
    ),
  },
  {
    id: 'changes',
    title: '처리방침 변경',
    children: (
      <p>
        이 개인정보 처리방침은 법령, 서비스 구조, 처리 항목, 외부 처리 제공자,
        보안 정책 변경에 따라 수정될 수 있습니다. 중요한 변경이 있는 경우
        서비스 화면 또는 별도 공지를 통해 안내합니다.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '문의',
    children: (
      <p>
        개인정보 열람, 정정, 삭제, 처리정지, 계정 접근과 관련된 문의는
        TransNote 서비스 운영자 또는 낭만 인프라 관리자에게 요청할 수 있습니다.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout
      eyebrow="Privacy Policy"
      title="개인정보 처리방침"
      description="TransNote가 이메일 로그인, 회의 기록, 전사, 노트, AI 결과물 생성을 위해 어떤 데이터를 처리하는지 설명합니다."
      effectiveDate={EFFECTIVE_DATE}
      sections={privacySections}
    />
  );
}
