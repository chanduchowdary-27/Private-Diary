import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DiaryList from '../pages/Diary/DiaryList';
import DiaryEntry from '../pages/Diary/DiaryEntry';
import Gallery from '../pages/Gallery/Gallery';
import Notes from '../pages/Notes/Notes';
import {
  resetDatabase,
  saveDiaryEntry,
  getDiaryEntries,
  saveMediaItem,
  getMediaItems,
  saveNote,
  getNotes,
  deleteNote,
  setSimulateSaveFailure,
  setSimulateUploadFailure,
  setActiveSession,
  clearActiveSession,
} from '../services/storageService';

describe('Mandatory Persistence Scenarios (1 to 16)', () => {
  beforeEach(async () => {
    setSimulateSaveFailure(false);
    setSimulateUploadFailure(false);
    await resetDatabase();
    setActiveSession({
      userId: 'test_princess',
      email: 'princess@test.com',
      isAuthenticated: true,
      isUnlocked: true,
    });
  });

  // Scenario 1: Create a diary entry, navigate to Notes, return to Diary, and verify entry still exists.
  it('Scenario 1: creates diary entry, navigates to Notes, returns to Diary, and verifies entry still exists', async () => {
    // Save a new entry via storage
    await saveDiaryEntry({
      title: 'A Golden Afternoon in the Castle',
      content: 'The swans were swimming by the marble fountain.',
      mood: 'peaceful',
    });

    // Mount Notes component (simulate navigating to Notes)
    const { unmount: unmountNotes } = render(
      <MemoryRouter initialEntries={['/notes']}>
        <Notes />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Notes & Planner')).toBeDefined());
    unmountNotes();

    // Mount DiaryList component (simulate returning to Diary)
    render(
      <MemoryRouter initialEntries={['/diary']}>
        <DiaryList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('A Golden Afternoon in the Castle')).toBeDefined();
    });
  });

  // Scenario 2: Create a diary entry, refresh the browser, and verify its content persists.
  it('Scenario 2: creates diary entry, simulates browser refresh, and verifies content persists', async () => {
    const entry = await saveDiaryEntry({
      title: 'Midnight Starlight Dream',
      content: 'Gazing at constellations from the tower.',
      mood: 'grateful',
    });

    // Simulate browser refresh by unmounting everything and mounting DiaryEntry from ID
    render(
      <MemoryRouter initialEntries={[`/diary/${entry.id}`]}>
        <Routes>
          <Route path="/diary/:id" element={<DiaryEntry />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      const titleInput = screen.getByLabelText('Entry title') as HTMLInputElement;
      expect(titleInput.value).toBe('Midnight Starlight Dream');
      const contentInput = screen.getByLabelText('Entry content') as HTMLTextAreaElement;
      expect(contentInput.value).toBe('Gazing at constellations from the tower.');
    });
  });

  // Scenario 3: Edit a diary entry and verify updated content persists after navigation and refresh.
  it('Scenario 3: edits diary entry and verifies updated content persists after navigation and refresh', async () => {
    const entry = await saveDiaryEntry({
      title: 'Initial Title',
      content: 'Initial text.',
    });

    // Edit entry in storage
    await saveDiaryEntry({
      id: entry.id,
      title: 'Updated Royal Chronicle',
      content: 'Edited royal text with enchanted ink.',
    });

    // Navigate to Notes
    const { unmount: unmountNotes } = render(
      <MemoryRouter>
        <Notes />
      </MemoryRouter>
    );
    unmountNotes();

    // Re-open DiaryList (simulating refresh and return)
    render(
      <MemoryRouter initialEntries={['/diary']}>
        <DiaryList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Updated Royal Chronicle')).toBeDefined();
      expect(screen.getByText('Edited royal text with enchanted ink.')).toBeDefined();
    });
  });

  // Scenario 4: Upload an image, navigate to another section, return to Gallery, and verify image is still displayed.
  it('Scenario 4: uploads image, navigates away, returns to Gallery, and verifies image is displayed', async () => {
    const imgBlob = new Blob(['sample-img-bytes'], { type: 'image/jpeg' });
    await saveMediaItem(imgBlob, 'palace_rose.jpg', 'Garden');

    // Navigate to Notes
    const { unmount: unmountNotes } = render(
      <MemoryRouter>
        <Notes />
      </MemoryRouter>
    );
    unmountNotes();

    // Return to Gallery
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('palace_rose.jpg')).toBeDefined();
      expect(screen.getByAltText('palace_rose.jpg')).toBeDefined();
    });
  });

  // Scenario 5: Upload an image, restart the application, and verify the image remains accessible.
  it('Scenario 5: uploads image, simulates application restart, and verifies image remains accessible', async () => {
    const imgBlob = new Blob(['sample-restart-bytes'], { type: 'image/png' });
    const saved = await saveMediaItem(imgBlob, 'crystal_tiara.png', 'All');

    // Simulate app restart by querying database directly then rendering fresh component
    const loadedFromDb = await getMediaItems();
    expect(loadedFromDb.some(m => m.id === saved.id)).toBe(true);

    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('crystal_tiara.png')).toBeDefined();
    });
  });

  // Scenario 6: Upload a video and verify its file and metadata persist.
  it('Scenario 6: uploads a video and verifies file and metadata persist', async () => {
    const vidBlob = new Blob(['sample-video-bytes'], { type: 'video/mp4' });
    const saved = await saveMediaItem(vidBlob, 'coronation_ball.mp4', 'Memories');

    expect(saved.type).toBe('video');
    expect(saved.mimeType).toBe('video/mp4');
    expect(saved.album).toBe('Memories');

    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('coronation_ball.mp4')).toBeDefined();
    });
  });

  // Scenario 7: Create a note, navigate to To-Do, return to Notes, and verify the note still exists.
  it('Scenario 7: creates note, navigates to To-Do, returns to Notes, and verifies note exists', async () => {
    await saveNote({
      type: 'note',
      title: 'Grand Library Whispers',
      content: 'Ancient tomes in the east wing.',
    });

    // Navigate to To-Do section
    const { unmount: unmountTodo } = render(
      <MemoryRouter initialEntries={['/todo']}>
        <Notes initialType="todo" />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('To-Do & Tasks')).toBeDefined());
    unmountTodo();

    // Return to Notes section (filter 'all' or 'note')
    render(
      <MemoryRouter initialEntries={['/notes']}>
        <Notes initialType="all" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Grand Library Whispers')).toBeDefined();
      expect(screen.getByText('Ancient tomes in the east wing.')).toBeDefined();
    });
  });

  // Scenario 8: Create multiple notes and verify they are not overwritten by one another.
  it('Scenario 8: creates multiple notes and verifies they do not overwrite each other', async () => {
    await saveNote({
      type: 'note',
      title: 'Note Alpha',
      content: 'Content Alpha',
    });

    await saveNote({
      type: 'note',
      title: 'Note Beta',
      content: 'Content Beta',
    });

    await saveNote({
      type: 'todo',
      title: 'Task Gamma',
      content: 'Content Gamma',
    });

    const all = await getNotes();
    expect(all.length).toBe(3);
    expect(all.map(n => n.title)).toEqual(expect.arrayContaining(['Note Alpha', 'Note Beta', 'Task Gamma']));
  });

  // Scenario 9: Refresh the browser and verify notes and to-do items persist.
  it('Scenario 9: simulates browser refresh and verifies notes and to-do items persist', async () => {
    await saveNote({ type: 'note', title: 'Persistent Note', content: 'Always here' });
    await saveNote({ type: 'todo', title: 'Persistent Task', content: 'Do not forget', completed: true });

    // Render fresh Notes after simulated refresh
    render(
      <MemoryRouter initialEntries={['/notes']}>
        <Notes initialType="all" />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Persistent Note')).toBeDefined();
      expect(screen.getByText('Persistent Task')).toBeDefined();
    });
  });

  // Scenario 10: Create notes, diary entries, gallery media, and to-do items together and verify all four types of data remain intact.
  it('Scenario 10: creates all four types of data together and verifies all remain intact', async () => {
    const diary = await saveDiaryEntry({ title: 'Shared Diary Entry', content: 'Diary content' });
    const note = await saveNote({ type: 'note', title: 'Shared Note Entry', content: 'Note content' });
    const todo = await saveNote({ type: 'todo', title: 'Shared Todo Entry', content: 'Todo content' });
    const media = await saveMediaItem(new Blob(['media'], { type: 'image/png' }), 'shared_art.png', 'Memories');

    const loadedEntries = await getDiaryEntries();
    const loadedNotes = await getNotes();
    const loadedMedia = await getMediaItems();

    expect(loadedEntries.some(e => e.id === diary.id)).toBe(true);
    expect(loadedNotes.some(n => n.id === note.id)).toBe(true);
    expect(loadedNotes.some(n => n.id === todo.id)).toBe(true);
    expect(loadedMedia.some(m => m.id === media.id)).toBe(true);
  });

  // Scenario 11: Edit and delete one item and verify unrelated records are unaffected.
  it('Scenario 11: edits and deletes one item and verifies unrelated records are unaffected', async () => {
    const item1 = await saveNote({ type: 'note', title: 'Keep Me', content: 'Safe' });
    const item2 = await saveNote({ type: 'note', title: 'Delete Me', content: 'Temporary' });
    const diary = await saveDiaryEntry({ title: 'Untouched Diary', content: 'Untouched' });

    // Delete item2
    await deleteNote(item2.id);

    const notesAfter = await getNotes();
    const diaryAfter = await getDiaryEntries();

    expect(notesAfter.some(n => n.id === item2.id)).toBe(false);
    expect(notesAfter.some(n => n.id === item1.id)).toBe(true);
    expect(diaryAfter.some(d => d.id === diary.id)).toBe(true);
  });

  // Scenario 12: Simulate a failed save and verify the UI displays an error instead of falsely reporting success.
  it('Scenario 12: simulates failed save and verifies UI displays error', async () => {
    setSimulateSaveFailure(true);

    render(
      <MemoryRouter initialEntries={['/diary/new']}>
        <Routes>
          <Route path="/diary/:id" element={<DiaryEntry />} />
        </Routes>
      </MemoryRouter>
    );

    const titleInput = screen.getByLabelText('Entry title');
    fireEvent.change(titleInput, { target: { value: 'Faulty Title' } });

    const saveBtn = screen.getByRole('button', { name: /save entry/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const statusElement = document.getElementById('diary-save-status');
      expect(statusElement?.textContent).toContain('Simulated database write error');
      expect(statusElement?.textContent).not.toContain('Saved & encrypted');
    });
  });

  // Scenario 13: Simulate a failed media upload and verify no invalid gallery record is presented as a successfully uploaded file.
  it('Scenario 13: simulates failed media upload and verifies no invalid gallery record is presented', async () => {
    setSimulateUploadFailure(true);

    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Gallery />
      </MemoryRouter>
    );

    const file = new File(['bad-data'], 'fail_pic.png', { type: 'image/png' });
    const fileInput = document.getElementById('media-file-input') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('fail_pic.png')).toBeDefined();
    });

    // Click upload on queue card
    const uploadBtn = document.querySelector('[id^="upload-btn-"]') as HTMLButtonElement;
    expect(uploadBtn).not.toBeNull();
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText(/Storage connection failed/i)).toBeDefined();
    });

    // Verify it is NOT present in the persisted records
    const persisted = await getMediaItems();
    expect(persisted.length).toBe(0);
  });

  // Scenario 14: Verify that switching sections repeatedly does not create duplicate records or erase existing data.
  it('Scenario 14: verifies switching sections repeatedly does not create duplicate records or erase data', async () => {
    await saveDiaryEntry({ title: 'Unique Chronicle', content: 'Only one copy' });

    for (let i = 0; i < 3; i++) {
      const { unmount: u1 } = render(
        <MemoryRouter initialEntries={['/diary']}><DiaryList /></MemoryRouter>
      );
      u1();
      const { unmount: u2 } = render(
        <MemoryRouter initialEntries={['/notes']}><Notes /></MemoryRouter>
      );
      u2();
      const { unmount: u3 } = render(
        <MemoryRouter initialEntries={['/gallery']}><Gallery /></MemoryRouter>
      );
      u3();
    }

    const entries = await getDiaryEntries();
    expect(entries.filter(e => e.title === 'Unique Chronicle').length).toBe(1);
  });

  // Scenario 15: Verify that data remains available after signing out and back in.
  it('Scenario 15: verifies data remains available after signing out and back in', async () => {
    const userSession = {
      userId: 'user_queen_aurora',
      email: 'aurora@royalty.org',
      isAuthenticated: true,
      isUnlocked: true,
    };
    setActiveSession(userSession);

    // Save user data
    await saveDiaryEntry({ title: "Aurora's Crown", content: 'Gold and rubies' }, userSession.userId);

    // Sign out (clear session)
    clearActiveSession();

    // Sign back in
    setActiveSession(userSession);

    const reloaded = await getDiaryEntries(userSession.userId);
    expect(reloaded.length).toBe(1);
    expect(reloaded[0].title).toBe("Aurora's Crown");
  });

  // Scenario 16: Verify that private data cannot be accessed by another user.
  it('Scenario 16: verifies private data cannot be accessed by another user', async () => {
    const userPrincess = 'user_princess_charlotte';
    const userIntruder = 'user_intruder_unknown';

    await saveDiaryEntry({ title: 'Secret Chamber Key', content: 'Under the crystal rose' }, userPrincess);
    await saveNote({ type: 'note', title: 'Royal Code', content: '1234' }, userPrincess);
    await saveMediaItem(new Blob(['royal-portrait'], { type: 'image/png' }), 'portrait.png', 'All', userPrincess);

    // Intruder queries
    const intruderEntries = await getDiaryEntries(userIntruder);
    const intruderNotes = await getNotes(userIntruder);
    const intruderMedia = await getMediaItems(userIntruder);

    expect(intruderEntries.length).toBe(0);
    expect(intruderNotes.length).toBe(0);
    expect(intruderMedia.length).toBe(0);
  });
});
