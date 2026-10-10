import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Welcome from '../pages/Welcome/Welcome';
import Unlock from '../pages/Unlock/Unlock';
import {
  resetDatabase,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
} from '../services/storageService';

describe('Security & Authentication Flow Tests', () => {
  beforeEach(async () => {
    await resetDatabase();
    clearActiveSession();
    vi.restoreAllMocks();
  });

  it('rejects sign-in when backend returns 401 and does NOT redirect to /unlock', async () => {
    // Mock fetch to simulate 401 invalid credentials
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid email or password.' }),
    } as Response);

    const onAuthMock = vi.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Welcome onAuth={onAuthMock} />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const pwdInput = screen.getByLabelText(/Account Password/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Enter Your Diary/i });

    fireEvent.change(emailInput, { target: { value: 'intruder@unknown.com' } });
    fireEvent.change(pwdInput, { target: { value: 'WrongPassword123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeDefined();
    });

    // onAuth was NOT called
    expect(onAuthMock).not.toHaveBeenCalled();

    // Session remains unauthenticated
    const session = getActiveSession();
    expect(session.isAuthenticated).toBe(false);
  });

  it('rejects duplicate registration when backend returns 409', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'An account with this email address already exists.' }),
    } as Response);

    const onAuthMock = vi.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Welcome onAuth={onAuthMock} />
      </MemoryRouter>
    );

    // Switch to register mode
    const regTab = screen.getByRole('button', { name: /Create Account/i });
    fireEvent.click(regTab);

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const pwdInput = screen.getByLabelText(/Account Password/i) as HTMLInputElement;
    const vaultInput = document.getElementById('vault-pwd') as HTMLInputElement;
    const confirmInput = screen.getByLabelText(/Confirm Vault Password/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Create My Diary/i });

    fireEvent.change(emailInput, { target: { value: 'existing@palace.com' } });
    fireEvent.change(pwdInput, { target: { value: 'ValidPassword123' } });
    fireEvent.change(vaultInput, { target: { value: 'VaultSecretKey123' } });
    fireEvent.change(confirmInput, { target: { value: 'VaultSecretKey123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('An account with this email address already exists.')).toBeDefined();
    });

    expect(onAuthMock).not.toHaveBeenCalled();
    expect(getActiveSession().isAuthenticated).toBe(false);
  });

  it('rejects vault unlock when vault password is wrong and does not redirect to home', async () => {
    setActiveSession({
      userId: 'user_aurora',
      email: 'aurora@palace.com',
      token: 'valid.auth.token',
      isAuthenticated: true,
      isUnlocked: false,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Incorrect vault password or invalid recovery key.' }),
    } as Response);

    const onUnlockMock = vi.fn();
    render(
      <MemoryRouter initialEntries={['/unlock']}>
        <Unlock onUnlock={onUnlockMock} />
      </MemoryRouter>
    );

    const vaultInput = screen.getByLabelText(/Vault Password/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Open My Diary/i });

    fireEvent.change(vaultInput, { target: { value: 'WrongVaultPassword' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Incorrect vault password or invalid recovery key.')).toBeDefined();
    });

    expect(onUnlockMock).not.toHaveBeenCalled();
    expect(getActiveSession().isUnlocked).toBe(false);
  });

  it('successful vault unlock sets isUnlocked true and updates token', async () => {
    setActiveSession({
      userId: 'user_aurora',
      email: 'aurora@palace.com',
      token: 'valid.auth.token',
      isAuthenticated: true,
      isUnlocked: false,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        userId: 'user_aurora',
        email: 'aurora@palace.com',
        token: 'unlocked.new.jwt.token',
        isUnlocked: true,
      }),
    } as Response);

    const onUnlockMock = vi.fn();
    render(
      <MemoryRouter initialEntries={['/unlock']}>
        <Unlock onUnlock={onUnlockMock} />
      </MemoryRouter>
    );

    const vaultInput = screen.getByLabelText(/Vault Password/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Open My Diary/i });

    fireEvent.change(vaultInput, { target: { value: 'CorrectVaultPassword123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onUnlockMock).toHaveBeenCalledWith('unlocked.new.jwt.token');
    });
  });

  it('signing out clears the active session and locks the vault', () => {
    setActiveSession({
      userId: 'user_aurora',
      email: 'aurora@palace.com',
      token: 'token123',
      isAuthenticated: true,
      isUnlocked: true,
    });

    clearActiveSession();

    const session = getActiveSession();
    expect(session.isAuthenticated).toBe(false);
    expect(session.isUnlocked).toBe(false);
    expect(session.token).toBe('');
  });
});
