'use client';

import { useCallback, useRef, useState } from 'react';
import { transcriptionApi } from '../api/transcriptionApi';

export type UploadState = 'idle' | 'requesting-url' | 'uploading' | 'completed' | 'failed';

export interface UploadResult {
  uploadId: string;
  s3Key: string;
  bucket: string;
  mediaUri: string;
}

export interface UploadOptions {
  /** 이 오디오 파일이 회의 시작 기준 몇 초 지점부터 녹음됐는지 (멀티 세션 병합용) */
  startOffsetSeconds?: number;
}

interface UseAudioUploadReturn {
  uploadState: UploadState;
  progress: number; // 0 ~ 100
  s3Key: string | null;
  bucket: string | null;
  error: string | null;
  upload: (
    meetingId: string,
    blob: Blob,
    options?: UploadOptions,
  ) => Promise<UploadResult | null>;
  reset: () => void;
}

const MAX_RETRIES = 3;

export function useAudioUpload(): UseAudioUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [s3Key, setS3Key] = useState<string | null>(null);
  const [bucket, setBucket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const uploadToPresignedUrl = useCallback(
    (url: string, blob: Blob): Promise<boolean> => {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.onprogress = (event: ProgressEvent) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true);
          } else {
            resolve(false);
          }
        };

        xhr.onerror = () => resolve(false);
        xhr.ontimeout = () => resolve(false);

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', 'audio/webm');
        xhr.timeout = 5 * 60 * 1000; // 5분 타임아웃
        xhr.send(blob);
      });
    },
    [],
  );

  const upload = useCallback(
    async (
      meetingId: string,
      blob: Blob,
      options?: UploadOptions,
    ): Promise<UploadResult | null> => {
      setError(null);
      setProgress(0);
      setS3Key(null);
      setBucket(null);

      let lastError: string | null = null;

      // 시도마다 presigned URL을 새로 발급한다.
      // (이전 시도가 5분 타임아웃으로 늦게 실패하면 presigned URL(10분)이
      // 만료되어 같은 URL 재시도는 무조건 403으로 실패하기 때문)
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        setUploadState('requesting-url');
        setProgress(0);

        let uploadUrl: string;
        let uploadId: string;
        let key: string;
        let bucketName: string;
        let mediaUri: string;

        try {
          const result = await transcriptionApi.getUploadUrl(
            meetingId,
            options?.startOffsetSeconds,
          );
          uploadId = result.uploadId;
          uploadUrl = result.uploadUrl;
          key = result.s3Key;
          bucketName = result.bucket;
          mediaUri = result.mediaUri;
        } catch (err) {
          lastError =
            err instanceof Error ? err.message : 'Presigned URL 요청에 실패했습니다.';
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          setError(lastError);
          setUploadState('failed');
          return null;
        }

        setUploadState('uploading');
        const success = await uploadToPresignedUrl(uploadUrl, blob);

        if (success) {
          setS3Key(key);
          setBucket(bucketName);
          setUploadState('completed');
          return {
            uploadId,
            s3Key: key,
            bucket: bucketName,
            mediaUri,
          };
        }

        lastError = '오디오 파일 업로드에 실패했습니다.';
        if (attempt < MAX_RETRIES) {
          // 재시도 전 잠시 대기
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      setError(
        lastError
          ? `${MAX_RETRIES}회 재시도 후에도 업로드에 실패했습니다. (${lastError})`
          : `${MAX_RETRIES}회 재시도 후에도 업로드에 실패했습니다.`,
      );
      setUploadState('failed');
      return null;
    },
    [uploadToPresignedUrl],
  );

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploadState('idle');
    setProgress(0);
    setS3Key(null);
    setBucket(null);
    setError(null);
  }, []);

  return {
    uploadState,
    progress,
    s3Key,
    bucket,
    error,
    upload,
    reset,
  };
}
