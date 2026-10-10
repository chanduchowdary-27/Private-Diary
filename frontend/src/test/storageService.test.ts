import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetDatabase,
  getDiaryEntries,
  getDiaryEntry,
  saveDiaryEntry,
  deleteDiaryEntry,
  getMediaItems,
  getMediaItem,
  saveMediaItem,
  deleteMediaItem,
  getNotes,
  getNote,
  saveNote,
  deleteNote,
  toggleTodoNote,
  setSimulateSaveFailure,
  setSimulateUploadFailure,
} from '../services/storageService';

describe('StorageService - IndexedDB Engine', () => {
  beforeEach(async () => {
    setSimulateSaveFailure(false);
    setSimulateUploadFailure(false);
    await resetDatabase();
  });

  describe('Diary persistence', () => {
    it('creates, reads, updates, and deletes diary entries', async () => {
      const entry = await saveDiaryEntry({
        title: 'Magical Evening',
        content: 'Watching the twilight skies.',
        mood: 'excited',
        tags: ['sky', 'twilight'],
      });

      expect(entry.id).toBeDefined();
      expect(entry.title).toBe('Magical Evening');
      expect(entry.createdAt).toBeDefined();
      expect(entry.updatedAt).toBeDefined();

      const fetched = await getDiaryEntry(entry.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.content).toBe('Watching the twilight skies.');

      // Update
      const updated = await saveDiaryEntry({
        id: entry.id,
        title: 'Magical Twilight Night',
        content: 'Watching twilight turn into stars.',
      });
      expect(updated.title).toBe('Magical Twilight Night');
      expect(updated.content).toBe('Watching twilight turn into stars.');

      const list = await getDiaryEntries();
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('Magical Twilight Night');

      // Delete
      const deleted = await deleteDiaryEntry(entry.id);
      expect(deleted).toBe(true);

      const listAfter = await getDiaryEntries();
      expect(listAfter.length).toBe(0);
    });

    it('throws error when simulateSaveFailure is enabled', async () => {
      setSimulateSaveFailure(true);
      await expect(
        saveDiaryEntry({ title: 'Test', content: 'Should fail' })
      ).rejects.toThrow('Simulated database write error');
    });
  });

  describe('Gallery persistence', () => {
    it('saves image blobs and persists metadata and file references', async () => {
      const imgBlob = new Blob(['fake image binary data'], { type: 'image/png' });
      const media = await saveMediaItem(imgBlob, 'garden_rose.png', 'Garden');

      expect(media.id).toBeDefined();
      expect(media.type).toBe('image');
      expect(media.name).toBe('garden_rose.png');
      expect(media.album).toBe('Garden');
      expect(media.url).toBeDefined();

      const items = await getMediaItems();
      expect(items.length).toBe(1);
      expect(items[0].name).toBe('garden_rose.png');

      const single = await getMediaItem(media.id);
      expect(single?.name).toBe('garden_rose.png');

      const deleted = await deleteMediaItem(media.id);
      expect(deleted).toBe(true);
      const itemsAfter = await getMediaItems();
      expect(itemsAfter.length).toBe(0);
    });

    it('saves video blobs and persists video metadata', async () => {
      const vidBlob = new Blob(['fake video stream bytes'], { type: 'video/mp4' });
      const video = await saveMediaItem(vidBlob, 'balcony_stars.mp4', 'Memories');

      expect(video.type).toBe('video');
      expect(video.mimeType).toBe('video/mp4');

      const items = await getMediaItems();
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('video');
    });

    it('rejects unsupported file formats', async () => {
      const exeBlob = new Blob(['bad binary'], { type: 'application/x-msdownload' });
      await expect(
        saveMediaItem(exeBlob, 'virus.exe', 'All')
      ).rejects.toThrow('Unsupported file type');
    });

    it('prevents duplicate submissions in the same album', async () => {
      const imgBlob = new Blob(['same content'], { type: 'image/jpeg' });
      await saveMediaItem(imgBlob, 'castle.jpg', 'Memories');

      await expect(
        saveMediaItem(imgBlob, 'castle.jpg', 'Memories')
      ).rejects.toThrow('already exists');
    });

    it('throws error and does not persist when simulated upload failure is active', async () => {
      setSimulateUploadFailure(true);
      const imgBlob = new Blob(['data'], { type: 'image/png' });
      await expect(
        saveMediaItem(imgBlob, 'test.png', 'All')
      ).rejects.toThrow('Simulated media upload failure');

      const items = await getMediaItems();
      expect(items.length).toBe(0);
    });
  });

  describe('Notes and To-Do persistence', () => {
    it('creates notes and to-dos independently without interference', async () => {
      const note = await saveNote({
        type: 'note',
        title: 'Secret Recipe',
        content: 'Flour, sugar, lavender essence.',
      });

      const todo = await saveNote({
        type: 'todo',
        title: 'Morning duties',
        content: 'Feed the royal swans',
        completed: false,
      });

      expect(note.type).toBe('note');
      expect(todo.type).toBe('todo');

      const all = await getNotes();
      expect(all.length).toBe(2);

      // Toggle todo
      const toggled = await toggleTodoNote(todo.id);
      expect(toggled?.completed).toBe(true);

      // Verify note remains unchanged
      const noteCheck = await getNote(note.id);
      expect(noteCheck?.title).toBe('Secret Recipe');
      expect(noteCheck?.content).toBe('Flour, sugar, lavender essence.');

      // Delete todo
      await deleteNote(todo.id);
      const allAfter = await getNotes();
      expect(allAfter.length).toBe(1);
      expect(allAfter[0].id).toBe(note.id);
    });
  });

  describe('Multi-user isolation and privacy', () => {
    it('prevents User A and User B from accessing each others private data', async () => {
      const userA = 'user_alice';
      const userB = 'user_bob';

      // User A creates diary, photo, and note
      await saveDiaryEntry({ title: "Alice's Secret", content: 'Private' }, userA);
      await saveMediaItem(new Blob(['alice'], { type: 'image/png' }), 'alice.png', 'All', userA);
      await saveNote({ type: 'note', title: "Alice's Plan", content: 'Plan' }, userA);

      // User B creates diary
      await saveDiaryEntry({ title: "Bob's Public Log", content: 'Hello' }, userB);

      // User A queries
      const aliceEntries = await getDiaryEntries(userA);
      const aliceMedia = await getMediaItems(userA);
      const aliceNotes = await getNotes(userA);
      expect(aliceEntries.length).toBe(1);
      expect(aliceEntries[0].title).toBe("Alice's Secret");
      expect(aliceMedia.length).toBe(1);
      expect(aliceNotes.length).toBe(1);

      // User B queries
      const bobEntries = await getDiaryEntries(userB);
      const bobMedia = await getMediaItems(userB);
      const bobNotes = await getNotes(userB);
      expect(bobEntries.length).toBe(1);
      expect(bobEntries[0].title).toBe("Bob's Public Log");
      expect(bobMedia.length).toBe(0);
      expect(bobNotes.length).toBe(0);

      // Cross-user fetch by ID returns null
      const crossFetch = await getDiaryEntry(aliceEntries[0].id, userB);
      expect(crossFetch).toBeNull();
    });
  });
});
