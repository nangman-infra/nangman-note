const DB_NAME = 'transnote-audio';
const DB_VERSION = 1;
const STORE_NAME = 'audio_chunks';

export interface AudioChunkRecord {
  id: string; // `${meetingId}_${chunkIndex}`
  meetingId: string;
  chunkIndex: number;
  blob: Blob;
  createdAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-meeting', 'meetingId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChunk(
  meetingId: string,
  chunkIndex: number,
  blob: Blob,
): Promise<void> {
  const db = await openDatabase();
  const record: AudioChunkRecord = {
    id: `${meetingId}_${chunkIndex}`,
    meetingId,
    chunkIndex,
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

export async function getAllChunks(meetingId: string): Promise<AudioChunkRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('by-meeting');
    const request = index.getAll(meetingId);

    request.onsuccess = () => {
      const records = (request.result as AudioChunkRecord[]).sort(
        (a, b) => a.chunkIndex - b.chunkIndex,
      );
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

export async function assembleBlob(meetingId: string): Promise<Blob | null> {
  const records = await getAllChunks(meetingId);
  if (records.length === 0) return null;

  const blobs = records.map((record) => record.blob);
  const mimeType = blobs[0]?.type || 'audio/webm;codecs=opus';
  return new Blob(blobs, { type: mimeType });
}