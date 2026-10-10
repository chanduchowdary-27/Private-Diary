// Synthetic data only — no real personal content

export type Mood =
  | 'happy' | 'sad' | 'excited' | 'peaceful'
  | 'anxious' | 'nostalgic' | 'grateful' | 'creative';

export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  mood: Mood;
  tags: string[];
  date: Date;
  mediaIds: string[];
  isDraft?: boolean;
}

export interface MediaObject {
  id: string;
  type: 'image' | 'video';
  mimeType: string;
  thumbnailUrl: string;
  entryId?: string;
  albumId?: string;
  createdAt: Date;
  encryptedSize: number;
}

export interface Note {
  id: string;
  type: 'note' | 'todo' | 'goal' | 'gratitude' | 'mood';
  title: string;
  content: string;
  tags: string[];
  completed?: boolean;
  createdAt: Date;
}

export const MOODS: { value: Mood; label: string; emoji: string; className: string }[] = [
  { value: 'happy',     label: 'Happy',     emoji: '☀️',  className: 'mood-happy'     },
  { value: 'excited',   label: 'Excited',   emoji: '✨',  className: 'mood-excited'   },
  { value: 'peaceful',  label: 'Peaceful',  emoji: '🌸',  className: 'mood-peaceful'  },
  { value: 'grateful',  label: 'Grateful',  emoji: '💖',  className: 'mood-grateful'  },
  { value: 'creative',  label: 'Creative',  emoji: '🎨',  className: 'mood-creative'  },
  { value: 'nostalgic', label: 'Nostalgic', emoji: '🌙',  className: 'mood-nostalgic' },
  { value: 'sad',       label: 'Sad',       emoji: '🌧️', className: 'mood-sad'       },
  { value: 'anxious',   label: 'Anxious',   emoji: '🌀',  className: 'mood-anxious'   },
];

export const SAMPLE_ENTRIES: DiaryEntry[] = [
  {
    id: 'e1',
    title: 'A Morning in the Garden',
    content: 'The roses are blooming beautifully today. I sat by the fountain for a long while, listening to the birds...',
    mood: 'peaceful',
    tags: ['morning', 'nature', 'reflection'],
    date: new Date(2026, 9, 8),
    mediaIds: ['m1'],
  },
  {
    id: 'e2',
    title: 'Stargazing Last Night',
    content: 'Watched the Milky Way stretch across the sky from the balcony. Made a wish on a shooting star...',
    mood: 'grateful',
    tags: ['night', 'stars', 'wishes'],
    date: new Date(2026, 9, 6),
    mediaIds: ['m2'],
  },
  {
    id: 'e3',
    title: 'New Recipe Adventure',
    content: 'Tried making lavender macarons for the first time! They came out a little lopsided but tasted magical...',
    mood: 'creative',
    tags: ['cooking', 'adventure', 'lavender'],
    date: new Date(2026, 9, 4),
    mediaIds: [],
  },
  {
    id: 'e4',
    title: 'Rainy Day Thoughts',
    content: 'The rain has been falling all morning. I made chamomile tea and read three chapters of my favourite novel...',
    mood: 'nostalgic',
    tags: ['rain', 'reading', 'cosy'],
    date: new Date(2026, 9, 2),
    mediaIds: [],
  },
  {
    id: 'e5',
    title: 'A Wonderful Surprise',
    content: 'Something truly delightful happened today — a little moment that reminded me the world can be magical...',
    mood: 'excited',
    tags: ['surprise', 'joy'],
    date: new Date(2026, 8, 29),
    mediaIds: ['m3', 'm4'],
  },
];

export const SAMPLE_NOTES: Note[] = [
  {
    id: 'n1',
    type: 'gratitude',
    title: 'Things I am grateful for',
    content: '1. Warm morning light\n2. Fresh jasmine tea\n3. A good night\'s sleep\n4. Kind words from a friend',
    tags: ['daily', 'gratitude'],
    createdAt: new Date(2026, 9, 9),
  },
  {
    id: 'n2',
    type: 'goal',
    title: 'October Goals 🌙',
    content: 'Read 2 books\nLearn 5 new piano pieces\nGo for walks every morning\nFinish the watercolour series',
    tags: ['goals', 'october'],
    createdAt: new Date(2026, 9, 1),
  },
  {
    id: 'n3',
    type: 'todo',
    title: 'Weekend Checklist',
    content: 'Water all the plants\nOrganize the bookshelf\nWrite letters to send\nBake banana bread',
    tags: ['weekend', 'tasks'],
    completed: false,
    createdAt: new Date(2026, 9, 9),
  },
];

export const DAILY_INSPIRATIONS = [
  'Every day is a new page in your story. ✨',
  'You are the author of your own fairytale. 🌸',
  'Even the smallest moments deserve to be remembered. 🌙',
  'Be gentle with yourself; you are a work in progress. 💖',
  'Magic is found in ordinary moments. 🦋',
  'Your story is worth telling. 🌟',
  'Today, choose joy. 🌷',
];
