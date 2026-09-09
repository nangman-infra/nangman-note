/**
 * Live, synthetic Bedrock evaluation (not part of Jest).
 * pnpm exec ts-node test/evaluate-long-notes.ts
 * EVALUATE_DEPLOYED_BASELINE=1 also compares the currently deployed dist service.
 * Prints metrics only unless EVALUATION_VERBOSE=1. Never reads a meeting or DB.
 */
import 'reflect-metadata';
import { createRequire } from 'node:module';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from '../src/shared/config/env.validation';
import { AwsClientFactory } from '../src/shared/aws/aws-client.factory';
import { BedrockService } from '../src/shared/aws/bedrock/bedrock.service';
import { PromptDocumentType } from '../src/domain/prompt/domain/prompt-document-type.enum';
import type { StructuredMeetingExtraction } from '../src/shared/aws/bedrock/bedrock.types';

const topics = [
  [
    '검색 인덱스',
    '300ms',
    '제목 검색만 제공하면 노트 본문의 중요한 키워드를 찾지 못합니다',
  ],
  [
    '자동 저장',
    '2000ms',
    '저장 응답을 기다리는 동안 사용자가 추가 입력을 할 수 있습니다',
  ],
  [
    '오프라인 복구',
    '24시간',
    '출장 중 네트워크가 끊어져도 초안을 다시 열 수 있어야 합니다',
  ],
  [
    '동시 편집',
    '409',
    '두 탭이 같은 버전의 문서를 동시에 변경하면 마지막 작성자가 앞의 내용을 잃게 할 수 있습니다',
  ],
  [
    '데이터 백업',
    '5분',
    '장애 직전까지 입력된 데이터와 마지막 백업 사이에 차이가 생깁니다',
  ],
  [
    '녹음 업로드',
    '10MB',
    '긴 녹음을 하나의 큰 파일로 올리면 전송 실패 시 처음부터 다시 시작하게 됩니다',
  ],
  [
    '배치 전사',
    '120분',
    '세션 후반부에서 정한 결론이 앞부분의 잠정 결정을 바꿀 수 있습니다',
  ],
  [
    '화자 식별',
    '8명',
    '동시에 발언한 참여자의 이름을 잘못 연결하면 담당자를 오인합니다',
  ],
  [
    '문서 내보내기',
    '50페이지',
    '많은 안건이 있는 회의록은 PDF 페이지 경계에서 표가 잘릴 수 있습니다',
  ],
  [
    '노트 버전',
    '30일',
    '수정 과정에서 과거의 결정 근거와 변경 이유를 찾아야 할 때가 있습니다',
  ],
  [
    '알림 제한',
    '3회',
    '자동 저장 실패마다 알림을 띄우면 정작 사용자가 처리해야 할 문제가 묻힙니다',
  ],
  [
    '권한 검사',
    '403',
    'URL만 알고 있는 다른 조직의 사용자가 문서 본문을 조회할 수 있어서는 안 됩니다',
  ],
  [
    '접근성',
    '44px',
    '작은 터치 대상은 이동 중 노트를 수정할 때 잘못 누르기 쉽습니다',
  ],
  [
    '휴지통',
    '14일',
    '실수로 지운 문서를 즉시 영구 삭제하면 복구 기회가 사라집니다',
  ],
  [
    '운영 모니터링',
    '60초',
    'AI 생성이 멈춘 상태를 사용자 신고 전에 감지해야 합니다',
  ],
  [
    '장문 요약',
    '18개',
    '서로 다른 주제를 일정 개수로 줄이면 회의 중간의 결정을 누락합니다',
  ],
  [
    '점진 배포',
    '10%',
    '새 버전의 오류가 전체 사용자에게 한 번에 영향을 주지 않도록 해야 합니다',
  ],
  [
    '롤백 검증',
    '15분',
    '배포 후 오류가 발견됐을 때 데이터 마이그레이션까지 안전하게 되돌려야 합니다',
  ],
].map(([title, value, context], index) => ({
  title,
  value,
  context,
  code: `NN-${String(index + 1).padStart(2, '0')}`,
  owner: ['지수', '민수', '서연'][index % 3],
  deadline: `2026-10-${String(index + 1).padStart(2, '0')}`,
}));

const transcriptSections = topics.map((topic, index) => {
  const start = index * 360;
  return [
    `[${start}.0s ~ ${start + 60}.0s] [화자: 지수] 이제 ${topic.title} 안건입니다. ${topic.context}. 이 안건의 작업 식별자는 ${topic.code}입니다. 현재 동작을 유지하는 안과 검증을 거쳐 수정하는 안을 비교하겠습니다. 빠르게 끝내는 것도 중요하지만 기능을 줄여서 완료하는 것은 이번 목표가 아닙니다. 사용자가 겪는 실제 실패 조건을 먼저 재현하고 그 조건에서 수정 결과를 확인해야 합니다.`,
    `[${start + 60}.0s ~ ${start + 120}.0s] [화자: 민수] 기존 방식은 구현 비용이 낮지만 ${topic.context}. 그래서 단순히 화면에 안내문만 추가하는 대안은 채택하지 않겠습니다. 실패를 재현하는 테스트와 실제 동작을 함께 고쳐야 합니다. 목표 수치는 ${topic.value}입니다. 평균적인 상황뿐 아니라 경계 조건도 확인하고 결과를 기록하겠습니다. 이 수치가 충족되는지 확인하지 않은 상태에서 완료로 표시해서는 안 됩니다.`,
    `[${start + 120}.0s ~ ${start + 180}.0s] [화자: 서연] 구체적인 검증 방법을 질문하겠습니다. 정상 흐름만 확인하면 되는지, 연결이 끊기거나 작업이 중복되는 상황도 포함하는지 궁금합니다. 사용자 입력을 지운 뒤 문제가 없다고 판단하는 테스트는 실제 이용 상황을 반영하지 못합니다. 재시도 전후로 데이터가 동일하게 남아 있는지 함께 확인해야 합니다. 확인이 불가능한 항목은 성공했다고 추측하지 말고 남은 과제로 별도 기록해주세요.`,
    `[${start + 180}.0s ~ ${start + 240}.0s] [화자: 지수] 두 상황을 모두 포함하는 것이 맞습니다. ${topic.title}의 정상 흐름과 실패 흐름을 각각 검증하는 것으로 결정합니다. ${topic.code}의 수용 기준은 ${topic.value}이고, 이전 결과와 비교한 측정값을 첨부해야 합니다. 일정 때문에 검증을 생략하는 대안은 거절합니다. 단, 실제 데이터로 확인되지 않은 효과를 성과 수치로 만들어 적지는 않겠습니다.`,
    `[${start + 240}.0s ~ ${start + 300}.0s] [화자: ${topic.owner}] 제가 ${topic.code} 작업을 맡겠습니다. ${topic.deadline}까지 ${topic.title} 수정과 재현 테스트를 완료하고 검증 결과를 공유하겠습니다. 구현 중 기존 저장 내용과 호환되지 않는 문제가 발견되면 즉시 알리고 변경안을 다시 검토받겠습니다. 담당자가 없는 조사 제안을 제 업무로 임의로 추가하지는 말아주세요. 확정된 작업과 아직 논의 중인 제안은 구분해서 기록해야 합니다.`,
    `[${start + 300}.0s ~ ${start + 359}.0s] [화자: 민수] 확인했습니다. ${topic.code} 담당은 ${topic.owner}, 기한은 ${topic.deadline}, 목표는 ${topic.value}입니다. 이 안건의 결정은 검증을 포함해 수정하는 것이며 안내문만 붙이는 안은 채택하지 않았습니다. 다음 안건에서도 같은 용어가 나오더라도 별개의 작업 식별자와 수용 기준을 가진다는 점을 기억해주세요. 서로 다른 안건을 하나의 포괄적인 개선 작업으로 합치면 검증과 담당 추적이 어려워집니다.`,
  ].join('\n');
});
const transcriptText =
  transcriptSections.join('\n') +
  '\n[6480.0s ~ 6500.0s] [화자: 지수] 마지막으로 ZZ-99는 기능 아이디어일 뿐입니다. 채택하지 않았고 담당자나 기한도 없으니 확정된 액션 아이템에 넣지 마세요.';

const normalize = (text: string) => text.replace(/[\s,]/g, '').toLowerCase();

async function main() {
  const values = {
    AWS_REGION: process.env.AWS_REGION || 'ap-northeast-2',
    AWS_PROFILE: process.env.AWS_PROFILE || '',
    AWS_BEDROCK_MODEL_ID:
      process.env.AWS_BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-5',
    AWS_BEDROCK_MAX_TOKENS: Number(process.env.AWS_BEDROCK_MAX_TOKENS || 16384),
  };
  const config = new ConfigService<AppEnv, true>(values);
  const factory = new AwsClientFactory(config);
  const services: Array<{ label: string; service: BedrockService }> = [];
  if (process.env.EVALUATE_DEPLOYED_BASELINE === '1') {
    const requireDeployed = createRequire(`${process.cwd()}/evaluation.cjs`);
    const deployed = requireDeployed(
      './dist/shared/aws/bedrock/bedrock.service.js',
    ) as { BedrockService: typeof BedrockService };
    services.push({
      label: 'deployed-baseline',
      service: new deployed.BedrockService(config, factory),
    });
  }
  services.push({
    label: 'improved',
    service: new BedrockService(config, factory),
  });

  for (const { label, service } of services) {
    const started = Date.now();
    const result = (await service.extractStructuredNotes({
      documentType: PromptDocumentType.MEETING,
      promptContent:
        '결정 근거, 수용 기준, 작업 식별자, 담당자와 기한을 구체적으로 기록하세요. 가정과 거절된 제안을 확정 작업으로 만들지 마세요.',
      noteContent: '',
      transcriptText,
      meetingTitle: '합성 검증용 108분 제품 개선 회의',
    })) as StructuredMeetingExtraction;
    const body = normalize(JSON.stringify(result));
    const actions = result.agendaItems.flatMap((item) => item.actionItems);
    const missingTopics = topics
      .filter((topic) => !body.includes(normalize(topic.code)))
      .map((topic) => topic.code);
    const missingValues = topics
      .filter((topic) => !body.includes(normalize(topic.value)))
      .map((topic) => topic.code);
    const completeActions = topics.filter((topic) =>
      result.agendaItems.some(
        (item) =>
          JSON.stringify(item).includes(topic.code) &&
          item.actionItems.some(
            (action) =>
              action.owner.includes(topic.owner) &&
              action.deadline.includes(topic.deadline),
          ),
      ),
    ).length;
    console.log(
      'EVALUATION_RESULT ' +
        JSON.stringify({
          label,
          model: values.AWS_BEDROCK_MODEL_ID,
          sourceChars: transcriptText.length,
          elapsedSeconds: Math.round((Date.now() - started) / 1000),
          outputChars: JSON.stringify(result).length,
          primaryTopics: result.agendaItems.length,
          expectedTopics: topics.length,
          coveredTopics: topics.length - missingTopics.length,
          missingTopics,
          missingValues,
          actions: actions.length,
          completeActions,
          inventedRejectedAction: actions.some((action) =>
            action.task.includes('ZZ-99'),
          ),
          ...(process.env.EVALUATION_VERBOSE === '1'
            ? { extraction: result }
            : {}),
        }),
    );
    if (process.env.EVALUATION_VERBOSE === '1') {
      for (const item of result.agendaItems) {
        console.log('EVALUATION_TOPIC ' + JSON.stringify(item));
      }
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
