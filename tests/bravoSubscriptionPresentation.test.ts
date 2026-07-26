import { describe, expect, test } from 'bun:test';
import {
  formatBravoSubscription,
  bravoProviderLabel,
} from '../src/features/bravo/bravoSubscriptionPresentation';

describe('Bravo subscription presentation', () => {
  test('uses an auth note as the bold identity and keeps account context secondary', () => {
    const identity = formatBravoSubscription({
      provider: 'codex',
      note: 'Личный аккаунт Марии',
      displayName: 'Maria',
      workspace: 'Personal',
      email: 'maria@example.test',
      plan: 'plus',
      effectiveTariff: 'x1',
    });

    expect(identity.title).toBe('Личный аккаунт Марии');
    expect(identity.subtitle).toBe('OpenAI Codex · Personal · maria@example.test · plus · x1');
  });

  test('does not let a legacy Claude email label hide Workspace + Email fallback', () => {
    const identity = formatBravoSubscription({
      provider: 'claude',
      label: 'nikita@example.test',
      workspace: 'Ascetix, inc',
      email: 'nikita@example.test',
      plan: 'team',
    });

    expect(identity.title).toBe('Ascetix, inc · nikita@example.test');
    expect(identity.subtitle).toBe('Claude · team');
  });

  test('keeps a legacy Codex human label as the identity when it is a real note', () => {
    const identity = formatBravoSubscription({
      provider: 'codex',
      label: 'x20 Аккаунт Никиты (Личный)',
      workspace: 'Personal',
      email: 'nikita@example.test',
      plan: 'pro',
    });

    expect(identity.title).toBe('x20 Аккаунт Никиты (Личный)');
    expect(identity.subtitle).toContain('Personal · nikita@example.test');
  });

  test('never exposes a filename or auth index as the human title', () => {
    const identity = formatBravoSubscription({
      provider: 'claude',
      displayName: 'claude-user--fd405533.json',
      authIndex: 'claude-user--fd405533.json',
      label: 'claude-user--fd405533.json',
      subscriptionId: 'sub_1234567890abcdefghijkl',
    });

    expect(identity.title).toBe('Claude · sub_1234…hijkl');
    expect(identity.title).not.toContain('.json');
  });

  test('treats a display name equal to an auth id as technical metadata', () => {
    const identity = formatBravoSubscription({
      provider: 'codex',
      displayName: 'auth-opaque-123',
      authId: 'auth-opaque-123',
      workspace: 'Personal',
      email: 'nikita@example.test',
    });

    expect(identity.title).toBe('Personal · nikita@example.test');
  });

  test('normalizes provider names consistently', () => {
    expect(bravoProviderLabel('anthropic')).toBe('Claude');
    expect(bravoProviderLabel('codex')).toBe('OpenAI Codex');
  });
});
