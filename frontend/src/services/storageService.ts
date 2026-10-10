import { SAMPLE_ENTRIES, SAMPLE_NOTES, type Mood } from '../utils/mockData';

export interface StoredDiaryEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: Mood;
  tags: string[];
  date: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  mediaIds: string[];
  isDraft?: boolean;
}

export interface StoredMediaItem {
  id: string;
  userId: string;
  name: string;
  type: 'image' | 'video';
  mimeType: string;
  size: number;
  blob: Blob;
  album: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export interface StoredNote {
  id: string;
  userId: string;
  type: 'note' | 'todo' | 'goal' | 'gratitude' | 'mood';
  title: string;
  content: string;
  tags: string[];
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  userId: string;
  email: string;
  token?: string;
  isAuthenticated: boolean;
  isUnlocked: boolean;
}

const DB_NAME = 'PrincessDiaryDB';
const DB_VERSION = 1;
const DEFAULT_USER_ID = 'test_princess';

const SESSION_STORAGE_KEY = 'princess_active_session';

// Simulation flags for testing failure states
let simulateSaveFailure = false;
let simulateUploadFailure = false;

export function setSimulateSaveFailure(val: boolean) {
  simulateSaveFailure = val;
}

export function setSimulateUploadFailure(val: boolean) {
  simulateUploadFailure = val;
}

async function syncToBackend(url: string, options: RequestInit): Promise<void> {
  try {
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      const session = getActiveSession();
      const headers = new Headers(options.headers || {});
      if (session.token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${session.token}`);
      }
      if (session.userId && !headers.has('x-user-id')) {
        headers.set('x-user-id', session.userId);
      }
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        clearActiveSession();
      }
    }
  } catch {
    // Offline / test fallback; local IndexedDB persists
  }
}

/**
 * Open or initialize the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Diary entries store
      if (!db.objectStoreNames.contains('diary_entries')) {
        const diaryStore = db.createObjectStore('diary_entries', { keyPath: 'id' });
        diaryStore.createIndex('userId', 'userId', { unique: false });
        diaryStore.createIndex('date', 'date', { unique: false });
        diaryStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Gallery media store (stores binary Blobs durably)
      if (!db.objectStoreNames.contains('gallery_media')) {
        const galleryStore = db.createObjectStore('gallery_media', { keyPath: 'id' });
        galleryStore.createIndex('userId', 'userId', { unique: false });
        galleryStore.createIndex('createdAt', 'createdAt', { unique: false });
        galleryStore.createIndex('album', 'album', { unique: false });
      }

      // Notes & To-Dos store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('userId', 'userId', { unique: false });
        notesStore.createIndex('type', 'type', { unique: false });
        notesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // User accounts store
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('email', 'email', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Helper to run a transaction
 */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let result: T;
    Promise.resolve()
      .then(() => callback(store))
      .then((res) => {
        result = res;
      })
      .catch((err) => {
        tx.abort();
        reject(err);
      });

    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(new Error('Transaction aborted'));
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   SESSION & USER MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

export function getActiveSession(): UserSession {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.isAuthenticated === 'boolean') {
        return parsed;
      }
    }
  } catch {
    // fallback if localStorage not accessible
  }
  return {
    userId: '',
    email: '',
    token: '',
    isAuthenticated: false,
    isUnlocked: false,
  };
}

export function setActiveSession(session: Partial<UserSession>): UserSession {
  const current = getActiveSession();
  const updated: UserSession = { ...current, ...session };
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  // Clear any active blob object URLs to prevent cache leaks between accounts
  activeObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  });
  activeObjectUrls.clear();
}

export function getCurrentUserId(): string {
  return getActiveSession().userId || DEFAULT_USER_ID;
}

/* ═══════════════════════════════════════════════════════════════
   INITIAL SEEDING
   ═══════════════════════════════════════════════════════════════ */

let seededUsers = new Set<string>();

export async function ensureInitialSeed(userId: string = getCurrentUserId()): Promise<void> {
  // Security rule: newly registered users must start with an empty vault.
  // Only explicitly designated demo accounts receive sample entries.
  if (userId !== 'demo_user' && userId !== 'demo') {
    return;
  }
  if (seededUsers.has(userId)) return;

  // Check diary entries
  const existingEntries = await getDiaryEntries(userId);
  if (existingEntries.length === 0) {
    const seeded = SAMPLE_ENTRIES.map((e) => ({
      ...e,
      userId,
      date: e.date.toISOString(),
      createdAt: e.date.toISOString(),
      updatedAt: e.date.toISOString(),
    }));
    for (const item of seeded) {
      await saveDiaryEntryDirect(item);
    }
  }

  // Check notes
  const existingNotes = await getNotes(userId);
  if (existingNotes.length === 0) {
    const seeded = SAMPLE_NOTES.map((n) => ({
      ...n,
      userId,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.createdAt.toISOString(),
    }));
    for (const item of seeded) {
      await saveNoteDirect(item);
    }
  }

  seededUsers.add(userId);
}

/* ═══════════════════════════════════════════════════════════════
   DIARY ENTRIES API
   ═══════════════════════════════════════════════════════════════ */

async function saveDiaryEntryDirect(entry: StoredDiaryEntry): Promise<StoredDiaryEntry> {
  return withStore('diary_entries', 'readwrite', (store) => {
    return new Promise<StoredDiaryEntry>((resolve, reject) => {
      const req = store.put(entry);
      req.onsuccess = () => resolve(entry);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getDiaryEntries(userId: string = getCurrentUserId()): Promise<StoredDiaryEntry[]> {
  return withStore('diary_entries', 'readonly', (store) => {
    return new Promise<StoredDiaryEntry[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const results: StoredDiaryEntry[] = req.result || [];
        // Sort descending by date
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getDiaryEntry(id: string, userId: string = getCurrentUserId()): Promise<StoredDiaryEntry | null> {
  return withStore('diary_entries', 'readonly', (store) => {
    return new Promise<StoredDiaryEntry | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const entry = req.result as StoredDiaryEntry | undefined;
        if (entry && entry.userId === userId) {
          resolve(entry);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function saveDiaryEntry(
  entryData: {
    id?: string;
    title: string;
    content: string;
    mood?: Mood;
    tags?: string[];
    date?: string | Date;
    mediaIds?: string[];
    isDraft?: boolean;
  },
  userId: string = getCurrentUserId()
): Promise<StoredDiaryEntry> {
  if (simulateSaveFailure) {
    throw new Error('Simulated database write error: Failed to save diary entry.');
  }

  const now = new Date().toISOString();
  const dateStr = entryData.date
    ? typeof entryData.date === 'string'
      ? entryData.date
      : entryData.date.toISOString()
    : now;

  const id = entryData.id && entryData.id !== 'new' ? entryData.id : crypto.randomUUID();

  // Check if updating existing
  const existing = await getDiaryEntry(id, userId);

  const entry: StoredDiaryEntry = {
    id,
    userId,
    title: entryData.title,
    content: entryData.content,
    mood: entryData.mood ?? existing?.mood ?? 'peaceful',
    tags: entryData.tags ?? existing?.tags ?? [],
    date: dateStr,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    mediaIds: entryData.mediaIds ?? existing?.mediaIds ?? [],
    isDraft: entryData.isDraft ?? existing?.isDraft ?? false,
  };

  const saved = await saveDiaryEntryDirect(entry);
  syncToBackend('/api/diary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({
      id: saved.id,
      title: saved.title,
      content: saved.content,
      mood: saved.mood,
      tags: saved.tags,
      date: saved.date,
    }),
  });
  return saved;
}

export async function deleteDiaryEntry(id: string, userId: string = getCurrentUserId()): Promise<boolean> {
  return withStore('diary_entries', 'readwrite', async (store) => {
    const existing = await new Promise<StoredDiaryEntry | null>((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (!existing || existing.userId !== userId) {
      return false;
    }

    return new Promise<boolean>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => {
        syncToBackend(`/api/diary/${id}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
        });
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   GALLERY MEDIA API
   ═══════════════════════════════════════════════════════════════ */

export const ACCEPTED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export const MAX_MEDIA_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

// Track active Object URLs to revoke them when no longer needed
const activeObjectUrls = new Map<string, string>();

export async function getMediaItems(userId: string = getCurrentUserId()): Promise<StoredMediaItem[]> {
  return withStore('gallery_media', 'readonly', (store) => {
    return new Promise<StoredMediaItem[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const results: StoredMediaItem[] = req.result || [];
        // Sort descending by createdAt
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Assign durable object URLs
        const withUrls = results.map((item) => {
          let url = activeObjectUrls.get(item.id);
          if (!url) {
            url = URL.createObjectURL(item.blob);
            activeObjectUrls.set(item.id, url);
          }
          return { ...item, url };
        });

        resolve(withUrls);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getMediaItem(id: string, userId: string = getCurrentUserId()): Promise<StoredMediaItem | null> {
  return withStore('gallery_media', 'readonly', (store) => {
    return new Promise<StoredMediaItem | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result as StoredMediaItem | undefined;
        if (item && item.userId === userId) {
          let url = activeObjectUrls.get(item.id);
          if (!url) {
            url = URL.createObjectURL(item.blob);
            activeObjectUrls.set(item.id, url);
          }
          resolve({ ...item, url });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function saveMediaItem(
  file: File | Blob,
  name: string,
  album: string = 'All',
  userId: string = getCurrentUserId()
): Promise<StoredMediaItem> {
  if (simulateUploadFailure) {
    throw new Error('Simulated media upload failure: Storage connection failed.');
  }

  // Format validation
  const mimeType = file.type || 'application/octet-stream';
  if (!ACCEPTED_MEDIA_TYPES.includes(mimeType) && !mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    throw new Error(`Unsupported file type: ${mimeType}. Accepted types: JPG, PNG, GIF, WebP, MP4, WebM, QuickTime.`);
  }

  // Size validation
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of 200 MB. (File size: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
  }

  // Check for duplicates in same album for user
  const existingItems = await getMediaItems(userId);
  const isDuplicate = existingItems.some(
    (item) => item.name === name && item.size === file.size && item.album === album
  );
  if (isDuplicate) {
    throw new Error(`A file named "${name}" with identical size already exists in album "${album}".`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const type: 'image' | 'video' = mimeType.startsWith('video/') ? 'video' : 'image';

  const mediaRecord: StoredMediaItem = {
    id,
    userId,
    name,
    type,
    mimeType,
    size: file.size,
    blob: file,
    album,
    createdAt: now,
    updatedAt: now,
  };

  await withStore('gallery_media', 'readwrite', (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.put(mediaRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  const url = URL.createObjectURL(file);
  activeObjectUrls.set(id, url);

  try {
    const formData = new FormData();
    formData.append('file', file, name);
    formData.append('album', album);
    syncToBackend('/api/gallery/upload', {
      method: 'POST',
      headers: { 'x-user-id': userId },
      body: formData,
    });
  } catch {
    // ignore
  }

  return { ...mediaRecord, url };
}

export async function deleteMediaItem(id: string, userId: string = getCurrentUserId()): Promise<boolean> {
  const existing = await getMediaItem(id, userId);
  if (!existing) return false;

  const url = activeObjectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    activeObjectUrls.delete(id);
  }

  return withStore('gallery_media', 'readwrite', (store) => {
    return new Promise<boolean>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => {
        syncToBackend(`/api/gallery/${id}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
        });
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   NOTES & TO-DOS API
   ═══════════════════════════════════════════════════════════════ */

async function saveNoteDirect(note: StoredNote): Promise<StoredNote> {
  return withStore('notes', 'readwrite', (store) => {
    return new Promise<StoredNote>((resolve, reject) => {
      const req = store.put(note);
      req.onsuccess = () => resolve(note);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getNotes(userId: string = getCurrentUserId()): Promise<StoredNote[]> {
  return withStore('notes', 'readonly', (store) => {
    return new Promise<StoredNote[]>((resolve, reject) => {
      const index = store.index('userId');
      const req = index.getAll(userId);
      req.onsuccess = () => {
        const results: StoredNote[] = req.result || [];
        // Sort descending by createdAt
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function getNote(id: string, userId: string = getCurrentUserId()): Promise<StoredNote | null> {
  return withStore('notes', 'readonly', (store) => {
    return new Promise<StoredNote | null>((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const note = req.result as StoredNote | undefined;
        if (note && note.userId === userId) {
          resolve(note);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function saveNote(
  noteData: {
    id?: string;
    type: 'note' | 'todo' | 'goal' | 'gratitude' | 'mood';
    title: string;
    content: string;
    tags?: string[];
    completed?: boolean;
  },
  userId: string = getCurrentUserId()
): Promise<StoredNote> {
  if (simulateSaveFailure) {
    throw new Error('Simulated database write error: Failed to save note.');
  }

  const id = noteData.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const existing = await getNote(id, userId);

  const note: StoredNote = {
    id,
    userId,
    type: noteData.type,
    title: noteData.title,
    content: noteData.content,
    tags: noteData.tags ?? existing?.tags ?? [],
    completed: noteData.completed ?? existing?.completed ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const saved = await saveNoteDirect(note);
  syncToBackend('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({
      id: saved.id,
      type: saved.type,
      title: saved.title,
      content: saved.content,
      tags: saved.tags,
      completed: saved.completed,
    }),
  });
  return saved;
}

export async function toggleTodoNote(id: string, userId: string = getCurrentUserId()): Promise<StoredNote | null> {
  const note = await getNote(id, userId);
  if (!note) return null;

  note.completed = !note.completed;
  note.updatedAt = new Date().toISOString();
  syncToBackend(`/api/notes/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'x-user-id': userId },
  });
  return saveNoteDirect(note);
}

export async function deleteNote(id: string, userId: string = getCurrentUserId()): Promise<boolean> {
  return withStore('notes', 'readwrite', async (store) => {
    const existing = await new Promise<StoredNote | null>((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    if (!existing || existing.userId !== userId) {
      return false;
    }

    return new Promise<boolean>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => {
        syncToBackend(`/api/notes/${id}`, {
          method: 'DELETE',
          headers: { 'x-user-id': userId },
        });
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   CLEAR DATABASE (FOR TESTING)
   ═══════════════════════════════════════════════════════════════ */

export async function resetDatabase(): Promise<void> {
  const db = await openDB();
  const storeNames = ['diary_entries', 'gallery_media', 'notes', 'users'];
  for (const name of storeNames) {
    if (db.objectStoreNames.contains(name)) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(name, 'readwrite');
        const req = tx.objectStore(name).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }
  db.close();
  seededUsers.clear();
  activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeObjectUrls.clear();
}
