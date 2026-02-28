'use client';

import { useCallback, useRef, useState } from 'react';
import { transcriptionApi } from '../api/transcriptionApi';

export type UploadState = 'idle' | 'requesting-url' | 'uploading' | 'completed' | 'failed';

interface UseAudioUploadReturn {
  uploadState: UploadState;
  progress: number; // 0 ~ 100
  s3Key: string | null;
  bucket: string | null;
  error: string | null;
  upload: (meetingId: string, blob: Blob) => Promise<string | null>;
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
    async (meetingId: string, blob: Blob): Promise<string | null> => {
      setError(null);
      setProgress(0);
      setS3Key(null);
      setBucket(null);

      // 1. Presigned URL 요청
      setUploadState('requesting-url');
      let uploadUrl: string;
      let key: string;

      let bucketName: string;

      try {
        const result = await transcriptionApi.getUploadUrl(meetingId);
        uploadUrl = result.uploadUrl;
        key = result.s3Key;
        bucketName = result.bucket;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Presigned URL 요청에 실패했습니다.';
        setError(message);
        setUploadState('failed');
        return null;
      }

      // 2. S3 업로드 (재시도 포함)
      setUploadState('uploading');

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        setProgress(0);
        const success = await uploadToPresignedUrl(uploadUrl, blob);

        if (success) {
          setS3Key(key);
          setBucket(bucketName);
          setUploadState('completed');
          return key;
        }

        if (attempt < MAX_RETRIES) {
          // 재시도 전 잠시 대기
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      setError(`${MAX_RETRIES}회 재시도 후에도 업로드에 실패했습니다.`);
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