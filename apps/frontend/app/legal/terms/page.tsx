import type { Metadata } from 'next';
import {
  LegalDocumentLayout,
  type LegalDocumentSection,
} from '../_components/LegalDocumentLayout';

export const metadata: Metadata = {
  title: '서비스 이용약관',
  description: 'TransNote 서비스 이용약관',
  alternates: {
    canonical: '/legal/terms',
  },
};

const EFFECTIVE_DATE = '2026년 4월 21일';

const termsSections: LegalDocumentSection[] = [
  {
    id: 'purpose',
    title: '목적',
    children: (
      <>
        <p>
          이 약관은 낭만 인프라가 제공하는 TransNote 서비스의 이용 조건,
          사용자와 운영자의 권리와 의무, 서비스 이용 중 발생할 수 있는 기본
          사항을 정합니다.
        </p>
        <p>
          TransNote는 회의 진행, 실시간 전사, 회의 노트 작성, AI 기반 결과물
          생성과 보관을 돕는 회의 기록 워크스페이스입니다.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    title: '계정 및 로그인',
    children: (
      <>
        <p>
          사용자는 이메일 매직 링크 또는 낭만 인프라 계정 로그인을 통해
          TransNote에 접속할 수 있습니다. 이메일 매직 링크 로그인은 이름과
          비밀번호를 요구하지 않으며, 이메일 주소는 로그인 링크 발송과 계정
          식별에 사용됩니다.
        </p>
        <p>
          사용자는 본인이 접근 권한을 가진 이메일 또는 조직 계정을 사용해야
          합니다. 다른 사람의 계정이나 인증 링크를 무단으로 사용해서는 안
          됩니다.
        </p>
      </>
    ),
  },
  {
    id: 'service-scope',
    title: '서비스 범위',
    children: (
      <>
        <p>
          TransNote는 회의 생성, 회의 아카이브 관리, 음성 전사, 번역 보조,
          노트 편집, 프롬프트 기반 결과물 생성, 결과물 내보내기 기능을
          제공합니다.
        </p>
        <p>
          서비스의 세부 기능은 운영 환경, 연결된 인증 제공자, 전사 제공자, AI
          처리 제공자, 저장소 설정에 따라 달라질 수 있습니다.
        </p>
      </>
    ),
  },
  {
    id: 'user-content',
    title: '회의 데이터와 사용자 콘텐츠',
    children: (
      <>
        <p>
          사용자가 입력하거나 업로드한 회의 제목, 안건, 음성, 전사문, 번역문,
          노트, 프롬프트, AI 생성 결과물은 사용자가 관리하는 콘텐츠입니다.
        </p>
        <p>
          사용자는 회의 참여자에게 필요한 고지나 동의를 직접 확인해야 합니다.
          특히 음성 녹음, 전사, 외부 AI 처리 과정에 민감정보나 제3자의
          개인정보가 포함될 수 있는 경우 더 주의해야 합니다.
        </p>
      </>
    ),
  },
  {
    id: 'ai-output',
    title: 'AI 결과물의 사용',
    children: (
      <>
        <p>
          TransNote의 AI 결과물은 회의 내용을 더 빠르게 정리하기 위한 보조
          자료입니다. 결과물은 원문 전사, 노트, 실제 회의 맥락과 다를 수
          있으므로 사용자가 최종 확인해야 합니다.
        </p>
        <p>
          사용자는 AI 결과물을 대외 배포, 의사결정, 계약, 법률·의료·재무 판단
          등에 사용하기 전에 정확성과 적합성을 직접 검토해야 합니다.
        </p>
      </>
    ),
  },
  {
    id: 'restricted-use',
    title: '금지되는 이용',
    children: (
      <ul className="list-disc space-y-2 pl-5">
        <li>타인의 계정, 인증 링크, 회의 자료를 무단으로 사용하는 행위</li>
        <li>불법 촬영, 불법 녹음, 권한 없는 개인정보 수집에 서비스를 이용하는 행위</li>
        <li>서비스 장애를 유발하거나 보안 기능을 우회하려는 행위</li>
        <li>타인의 권리, 영업비밀, 저작권, 개인정보를 침해하는 콘텐츠를 처리하는 행위</li>
      </ul>
    ),
  },
  {
    id: 'availability',
    title: '서비스 변경 및 중단',
    children: (
      <>
        <p>
          운영자는 서비스 안정성, 보안, 기능 개선, 외부 제공자 변경, 인프라
          점검을 위해 서비스의 일부 기능을 변경하거나 일시 중단할 수 있습니다.
        </p>
        <p>
          중요한 변경이 사용자에게 중대한 영향을 주는 경우, 운영자는 서비스
          화면이나 별도 공지를 통해 가능한 범위에서 미리 안내합니다.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: '책임의 범위',
    children: (
      <>
        <p>
          운영자는 서비스의 안정적인 제공을 위해 합리적인 노력을 다합니다.
          다만 사용자의 네트워크 환경, 외부 인증·전사·AI 제공자의 장애, 사용자가
          입력한 콘텐츠의 부정확성으로 발생한 문제에 대해서는 책임이 제한될 수
          있습니다.
        </p>
        <p>
          사용자는 본인이 생성·보관·공유하는 회의 자료와 AI 결과물의 사용
          목적, 공유 범위, 보안 수준을 직접 관리해야 합니다.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '약관 변경',
    children: (
      <p>
        운영자는 법령, 서비스 구조, 보안 정책, 운영 방식 변경에 따라 이 약관을
        수정할 수 있습니다. 변경된 약관은 서비스 내 게시 또는 공지를 통해
        안내하며, 별도 시행일이 표시된 경우 그 날짜부터 적용됩니다.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '문의',
    children: (
      <p>
        서비스 이용, 계정 접근, 회의 데이터 처리와 관련된 문의는 TransNote
        서비스 운영자 또는 낭만 인프라 관리자에게 요청할 수 있습니다.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocumentLayout
      eyebrow="Terms of Service"
      title="서비스 이용약관"
      description="TransNote를 이용할 때 적용되는 계정, 회의 데이터, AI 결과물, 서비스 운영 기준을 정리했습니다."
      effectiveDate={EFFECTIVE_DATE}
      sections={termsSections}
    />
  );
}
