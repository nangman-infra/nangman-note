const DB_NAME = 'transnote-audio';
const DB_VERSION = 2;
const STORE_NAME = 'audio_chunks';

/** 세션 구분이 없던 v1 레코드가 매핑되는 레거시 세션 ID */
const LEGACY_SESSION_ID = 'legacy';

export interface AudioChunkRecord {
  id: string; // `${meetingId}_${sessionId}_${chunkIndex}`
  meetingId: string;
  /**
   * 녹음 세션(MediaRecorder 인스턴스) 식별자.
   * 새로고침·마이크 교체 등으로 녹음이 재시작되면 새 세션이 생성되어
   * 이전 세션의 청크를 덮어쓰지 않습니다.
   */
  sessionId: string;
  chunkIndex: number;
  /** 세션 녹음 시작 시각 (epoch ms) — 세션 정렬 및 회의 시작 기준 오프셋 계산용 */
  sessionStartedAt: number;
  blob: Blob;
  createdAt: number;
}

export interface RecordedSessionBlob {
  sessionId: string;
  /** 세션 녹음 시작 시각 (epoch ms) */
  startedAt: number;
  blob: Blob;
}

/** 연결을 재사용해 회의당 수백 개의 IDB 연결이 누적되는 것을 방지 */
let dbPromise: Promise<IDBDatabase> | null = null;
let staleChunkGcScheduled = false;

/** 중단된 회의가 남긴 고아 청크의 보존 기간 */
const STALE_CHUNK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 정상 종료되지 못한 회의(탭 강제 종료 등)가 남긴 오래된 청크를 정리한다.
 * happy path의 clearChunks만으로는 고아 청크가 영구 누적되어
 * 브라우저 저장 공간을 잠식한다.
 */
async function purgeStaleChunks(): Promise<void> {
  try {
    const db = await openDatabase();
    const cutoff = Date.now() - STALE_CHUNK_MAX_AGE_MS;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const record = cursor.value as AudioChunkRecord;
        if (typeof record.createdAt === 'number' && record.createdAt < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // GC 실패는 무해 — 다음 세션에서 재시도
  }
}

function scheduleStaleChunkGc(): void {
  if (staleChunkGcScheduled) return;
  staleChunkGcScheduled = true;
  // 녹음 시작 직후 블로킹하지 않도록 유휴 시점에 실행
  setTimeout(() => {
    void purgeStaleChunks();
  }, 10_000);
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-meeting', 'meetingId', { unique: false });
      }
      // v1 → v2: 스키마 변경 없음 (레코드에 sessionId 필드가 추가됐지만
      // keyPath 기반 store라 기존 레코드는 읽기 시 레거시 세션으로 매핑)
    };

    request.onsuccess = () => {
      const db = request.result;
      // 다른 탭에서 버전 업그레이드 시 연결을 닫아 블로킹 방지
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function saveChunk(
  meetingId: string,
  sessionId: string,
  chunkIndex: number,
  sessionStartedAt: number,
  blob: Blob,
): Promise<void> {
  const db = await openDatabase();
  scheduleStaleChunkGc();
  const record: AudioChunkRecord = {
    id: `${meetingId}_${sessionId}_${chunkIndex}`,
    meetingId,
    sessionId,
    chunkIndex,
    sessionStartedAt,
    blob,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeRecord(record: AudioChunkRecord): AudioChunkRecord {
  // v1 레코드 (sessionId 없음) → 레거시 세션으로 매핑
  if (!record.sessionId) {
    return {
      ...record,
      sessionId: LEGACY_SESSION_ID,
      sessionStartedAt: record.sessionStartedAt ?? record.createdAt,
    };
  }
  return record;
}

export async function getAllChunks(meetingId: string): Promise<AudioChunkRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('by-meeting');
    const request = index.getAll(meetingId);

    request.onsuccess = () => {
      const records = (request.result as AudioChunkRecord[])
        .map(normalizeRecord)
        .sort((a, b) => {
          if (a.sessionId !== b.sessionId) {
            return a.sessionStartedAt - b.sessionStartedAt;
          }
          return a.chunkIndex - b.chunkIndex;
        });
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearChunks(meetingId: string): Promise<void> {
  const db = await openDatabase();
  const records = await getAllChunks(meetingId);

  if (records.length === 0) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const record of records) {
      store.delete(record.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 회의의 녹음 세션별 오디오 블롭 목록을 조립합니다.
 *
 * MediaRecorder 인스턴스마다 독립된 WebM 헤더를 가진 파일이 생성되므로,
 * 세션 간 청크를 단순 연결하면 손상된 파일이 됩니다. 세션별로 분리해
 * 각각 유효한 WebM 파일로 반환하고, 업로드도 파일 단위로 수행합니다.
 */
export async function assembleSessionBlobs(
  meetingId: string,
): Promise<RecordedSessionBlob[]> {
  const records = await getAllChunks(meetingId);
  if (records.length === 0) return [];

  const sessions = new Map<string, AudioChunkRecord[]>();
  for (const record of records) {
    const chunks = sessions.get(record.sessionId);
    if (chunks) {
      chunks.push(record);
    } else {
      sessions.set(record.sessionId, [record]);
    }
  }

  const result: RecordedSessionBlob[] = [];
  for (const [sessionId, chunks] of sessions) {
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const blobs = chunks.map((chunk) => chunk.blob);
    const mimeType = blobs[0]?.type || 'audio/webm;codecs=opus';
    const startedAt = Math.min(...chunks.map((chunk) => chunk.sessionStartedAt));
    result.push({
      sessionId,
      startedAt,
      blob: new Blob(blobs, { type: mimeType }),
    });
  }

  result.sort((a, b) => a.startedAt - b.startedAt);
  return result;
}

/**
 * @deprecated 세션 간 청크를 단순 연결하면 다중 WebM 헤더로 손상될 수 있습니다.
 * `assembleSessionBlobs`를 사용하세요. (단일 세션이면 동일한 결과)
 */
export async function assembleBlob(meetingId: string): Promise<Blob | null> {
  const sessions = await assembleSessionBlobs(meetingId);
  if (sessions.length === 0) return null;
  if (sessions.length === 1) return sessions[0].blob;

  const blobs = sessions.map((session) => session.blob);
  const mimeType = blobs[0]?.type || 'audio/webm;codecs=opus';
  return new Blob(blobs, { type: mimeType });
}
