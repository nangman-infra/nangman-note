'use client';

import { useCallback, useRef, useState } from 'react';
import { FileAudio, Loader2, Upload, X } from 'lucide-react';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { meetingApi, MeetingTranscriptionMode } from '@/domains/meeting';
import { transcriptionApi } from '@/domains/transcription';

/** AWS Transcribe 지원 포맷 */
const ACCEPTED_EXTENSIONS = ['.webm', '.mp3', '.mp4', '.m4a', '.wav', '.flac', '.ogg', '.amr'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB (Transcribe 한도)

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/x-m4a',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  amr: 'audio/amr',
};

type UploadPhase = 'idle' | 'creating' | 'uploading' | 'confirming';

interface UploadAudioDialogProps {
  open: boolean;
  onClose: () => void;
  /** 업로드 완료 후 목록 갱신 트리거 */
  onUploaded: () => void;
}

function resolveContentType(file: File): string | null {
  if (file.type && EXTENSION_CONTENT_TYPES[getExtension(file.name) ?? '']) {
    // 확장자 기준을 우선 사용 (브라우저별 MIME 편차 회피)
    return EXTENSION_CONTENT_TYPES[getExtension(file.name)!];
  }
  const extension = getExtension(file.name);
  if (extension && EXTENSION_CONTENT_TYPES[extension]) {
    return EXTENSION_CONTENT_TYPES[extension];
  }
  if (file.type && Object.values(EXTENSION_CONTENT_TYPES).includes(file.type)) {
    return file.type;
  }
  return null;
}

function getExtension(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toLowerCase() : null;
}

function getDefaultTitle(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, '').slice(0, 255) || '업로드한 오디오';
}

export function UploadAudioDialog({ open, onClose, onUploaded }: UploadAudioDialogProps) {
  const { pushToast } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 재시도 시 회의를 재사용하기 위한 참조 (실패마다 고아 회의가 쌓이는 것 방지) */
  const createdMeetingIdRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = phase !== 'idle';

  const discardCreatedMeeting = async () => {
    const meetingId = createdMeetingIdRef.current;
    if (!meetingId) return;
    createdMeetingIdRef.current = null;
    try {
      // 업로드가 끝내 실패한 회의는 휴지통으로 이동해 목록 오염 방지
      await meetingApi.delete(meetingId);
    } catch {
      // 삭제 실패 시 stalled recovery가 정리한다
    }
  };

  const resetAndClose = useCallback(() => {
    if (isBusy) return;
    // 업로드 실패로 남은 회의가 있으면 정리 후 닫기
    void (async () => {
      const meetingId = createdMeetingIdRef.current;
      if (meetingId) {
        createdMeetingIdRef.current = null;
        try {
          await meetingApi.delete(meetingId);
        } catch {
          // 무해 — recovery가 정리
        }
      }
    })();
    setFile(null);
    setTitle('');
    setProgress(0);
    setErrorMessage(null);
    onClose();
  }, [isBusy, onClose]);

  const handleFileSelect = (selected: File | null) => {
    setErrorMessage(null);
    if (!selected) return;

    if (!resolveContentType(selected)) {
      setErrorMessage(
        `지원하지 않는 파일 형식입니다. 지원 형식: ${ACCEPTED_EXTENSIONS.join(', ')}`,
      );
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('파일이 너무 큽니다. 최대 2GB까지 업로드할 수 있습니다.');
      return;
    }

    setFile(selected);
    setTitle((prev) => prev || getDefaultTitle(selected.name));
  };

  const uploadToPresignedUrl = (url: string, blob: File, contentType: string) =>
    new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.ontimeout = () => resolve(false);
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.timeout = 30 * 60 * 1000; // 대용량 파일 대비 30분
      xhr.send(blob);
    });

  const handleSubmit = async () => {
    if (!file || isBusy) return;
    const contentType = resolveContentType(file);
    if (!contentType) return;

    setErrorMessage(null);
    // setState는 비동기이므로 catch에서 단계 판별용 로컬 변수를 사용
    let stage: UploadPhase = 'creating';

    try {
      // 1. 배치 모드 회의 생성 → 즉시 종료(전사 대기 상태로 전환)
      //    재시도인 경우 이전에 만든 회의를 재사용한다 (중복 회의 방지)
      setPhase('creating');
      let meetingId = createdMeetingIdRef.current;
      if (!meetingId) {
        const meeting = await meetingApi.create({
          title: title.trim() || getDefaultTitle(file.name),
          transcriptionMode: MeetingTranscriptionMode.BATCH,
        });
        createdMeetingIdRef.current = meeting.id;
        meetingId = meeting.id;
        await meetingApi.complete(meetingId);
      }

      // 2. presigned URL 발급 → 업로드 (실패 시 URL 재발급 포함 3회 시도)
      stage = 'uploading';
      setPhase('uploading');
      let uploadId: string | null = null;
      for (let attempt = 1; attempt <= 3 && !uploadId; attempt++) {
        setProgress(0);
        const issued = await transcriptionApi.getUploadUrl(meetingId, 0, contentType);
        const ok = await uploadToPresignedUrl(issued.uploadUrl, file, contentType);
        if (ok) {
          uploadId = issued.uploadId;
        } else if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      if (!uploadId) {
        setPhase('idle');
        setErrorMessage(
          '파일 업로드에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
        );
        return;
      }

      // 3. 업로드 확정 → 전사 잡 시작 (실패해도 서버가 30초 내 자동 큐잉)
      stage = 'confirming';
      setPhase('confirming');
      try {
        await transcriptionApi.confirmUpload(meetingId, uploadId);
      } catch {
        // 서버 정합성 보정이 자동으로 잡을 큐잉한다
      }

      pushToast({
        title: '오디오 업로드가 완료되었습니다',
        description: '전사와 AI 회의록 생성이 시작됩니다. 완료되면 목록에서 확인하세요.',
        variant: 'success',
      });
      createdMeetingIdRef.current = null;
      setPhase('idle');
      setFile(null);
      setTitle('');
      setProgress(0);
      onUploaded();
      onClose();
    } catch (error) {
      setPhase('idle');
      // create 후 complete 실패 등으로 어중간하게 남은 회의는 정리
      // (업로드 단계 도달 전 실패만 정리 — 재시도 시 새로 생성)
      if (createdMeetingIdRef.current && stage === 'creating') {
        await discardCreatedMeeting();
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '업로드 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      );
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="오디오 파일 업로드"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-lg font-bold text-slate-900">
            오디오 파일 업로드
          </h3>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={isBusy}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-40"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          기존 녹음 파일을 업로드하면 전사와 AI 회의록이 자동으로 생성됩니다.
        </p>

        <div className="mt-5 space-y-4">
          {/* 파일 선택 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
          >
            <FileAudio className="h-7 w-7 text-indigo-500" />
            {file ? (
              <span className="text-sm font-semibold text-slate-800">
                {file.name}
                <span className="ml-1 font-normal text-slate-400">
                  ({(file.size / (1024 * 1024)).toFixed(1)}MB)
                </span>
              </span>
            ) : (
              <span className="text-sm text-slate-500">
                클릭하여 파일 선택
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  {ACCEPTED_EXTENSIONS.join(' ')}
                </span>
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            className="hidden"
            onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
          />

          {/* 제목 */}
          <div>
            <label htmlFor="upload-audio-title" className="mb-1 block text-xs font-semibold text-slate-600">
              회의 제목
            </label>
            <input
              id="upload-audio-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              disabled={isBusy}
              placeholder="예: 3월 정기 회의 녹음"
              className="input-shell w-full text-sm"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {phase === 'uploading' ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[11px] text-slate-500">{progress}%</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!file || isBusy}
            className="btn-primary inline-flex w-full justify-center"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'creating' && '회의 생성 중...'}
                {phase === 'uploading' && '업로드 중...'}
                {phase === 'confirming' && '전사 시작 중...'}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                업로드 및 전사 시작
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
