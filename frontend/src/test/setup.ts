import 'fake-indexeddb/auto';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => `blob:mock-url-${Math.random().toString(36).slice(2)}`);
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
  if (!window.confirm) {
    window.confirm = vi.fn(() => true);
  }
  if (!window.alert) {
    window.alert = vi.fn();
  }
}
