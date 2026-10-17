// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import fs from 'fs';
import path from 'path';
import axe from 'axe-core';
import {
  FlashToggle,
  getInitialFlashPreference,
  saveFlashPreference,
} from '../src/client/components/FlashToggle.js';
import { ResidentAlert } from '../src/client/components/ResidentAlert.js';
import { QuickReplies } from '../src/client/components/QuickReplies.js';
import { VisitorScreen } from '../src/client/components/VisitorScreen.js';
import { AlertPayload } from '../src/shared/types.js';

describe('Task 4: Accessibility Hardening & WCAG 2.3.1 Flashing Safeguards', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  describe('1. WCAG 2.3.1 Flashing Safeguards & CSS Media Queries', () => {
    const cssPath = path.resolve(__dirname, '../src/client/styles/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    it('enforces strobe flash rate <= 2 flashes/sec (below WCAG 2.3.1 3/sec threshold)', () => {
      // Find animation duration for safeStrobe or .strobe-alert
      const strobeMatch = cssContent.match(
        /\.strobe-alert\s*\{[^}]*animation:\s*([a-zA-Z0-9_-]+)\s+([0-9.]+)s/
      );
      expect(strobeMatch).toBeTruthy();
      if (strobeMatch) {
        const durationSeconds = parseFloat(strobeMatch[2]);
        // Duration of 0.5s or higher guarantees <= 2 flashes/sec (1/0.5s = 2.0 Hz)
        expect(durationSeconds).toBeGreaterThanOrEqual(0.5);
        const flashRate = 1 / durationSeconds;
        expect(flashRate).toBeLessThanOrEqual(2.0); // Strict <= 2 flashes/second
      }
    });

    it('contains prefers-reduced-motion media query that disables strobe animation', () => {
      expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
      // Must contain rule disabling animations or setting .strobe-alert animation: none
      const reducedMotionBlock = cssContent.split('@media (prefers-reduced-motion: reduce)')[1];
      expect(reducedMotionBlock).toBeTruthy();
      expect(reducedMotionBlock).toMatch(/(animation:\s*none|animation-duration:\s*0\.01ms)/);
    });
  });

  describe('2. Flash Preference Detection & Persistence', () => {
    it('returns saved localStorage preference if present', () => {
      localStorage.setItem('signaldoor_flash_enabled', 'false');
      expect(getInitialFlashPreference()).toBe(false);

      localStorage.setItem('signaldoor_flash_enabled', 'true');
      expect(getInitialFlashPreference()).toBe(true);
    });

    it('auto-disables when prefers-reduced-motion is active and no localStorage key exists', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(getInitialFlashPreference()).toBe(false);
    });

    it('defaults to true when prefers-reduced-motion is false and no localStorage key exists', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      expect(getInitialFlashPreference()).toBe(true);
    });

    it('saves user choice to localStorage on saveFlashPreference', () => {
      saveFlashPreference(false);
      expect(localStorage.getItem('signaldoor_flash_enabled')).toBe('false');

      saveFlashPreference(true);
      expect(localStorage.getItem('signaldoor_flash_enabled')).toBe('true');
    });
  });

  describe('3. FlashToggle Accessible Switch Component', () => {
    it('renders accessible role="switch" with aria-checked and aria-label', async () => {
      const onToggle = vi.fn();
      const root = createRoot(container);
      root.render(React.createElement(FlashToggle, { enabled: true, onToggle }));
      await new Promise((r) => setTimeout(r, 20));

      const toggleButton = container.querySelector('[role="switch"]') as HTMLButtonElement;
      expect(toggleButton).toBeTruthy();
      expect(toggleButton.getAttribute('aria-checked')).toBe('true');
      expect(toggleButton.getAttribute('aria-label')).toMatch(/flash|strobe/i);

      // Verify touch target >= 44px
      expect(toggleButton.style.minHeight).toMatch(/(44px|48px)/);
    });

    it('invokes onToggle with false when clicked while enabled', async () => {
      const onToggle = vi.fn();
      const root = createRoot(container);
      root.render(React.createElement(FlashToggle, { enabled: true, onToggle }));
      await new Promise((r) => setTimeout(r, 20));

      const toggleButton = container.querySelector('[role="switch"]') as HTMLButtonElement;
      toggleButton.click();
      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('invokes onToggle with true when clicked while disabled', async () => {
      const onToggle = vi.fn();
      const root = createRoot(container);
      root.render(React.createElement(FlashToggle, { enabled: false, onToggle }));
      await new Promise((r) => setTimeout(r, 20));

      const toggleButton = container.querySelector('[role="switch"]') as HTMLButtonElement;
      expect(toggleButton.getAttribute('aria-checked')).toBe('false');
      toggleButton.click();
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('4. ResidentAlert Typography & Flashing Compliance', () => {
    const mockAlert: AlertPayload = {
      eventId: 'evt-test-wcag-01',
      phase: 'PHASE_1_IMMEDIATE',
      title: 'Doorbell Pressed',
      body: 'Someone is at your door',
      timestamp: new Date().toISOString(),
      timeoutFallback: false,
    };

    it('applies strobe-alert class only when flashEnabled is true', async () => {
      const root = createRoot(container);
      root.render(
        React.createElement(ResidentAlert, {
          alert: mockAlert,
          onDismiss: vi.fn(),
          flashEnabled: true,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const alertSection = container.querySelector('section[role="alert"]');
      expect(alertSection).toBeTruthy();
      expect(alertSection?.classList.contains('strobe-alert')).toBe(true);

      // Re-render with flashEnabled={false}
      root.render(
        React.createElement(ResidentAlert, {
          alert: mockAlert,
          onDismiss: vi.fn(),
          flashEnabled: false,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const updatedSection = container.querySelector('section[role="alert"]');
      expect(updatedSection?.classList.contains('strobe-alert')).toBe(false);
    });

    it('sets role="alert" and aria-live="assertive" for Phase 1 new visitor, and aria-live="polite" with role="status" for Phase 2 updates', async () => {
      const root = createRoot(container);

      // Phase 1: immediate visitor alert
      root.render(
        React.createElement(ResidentAlert, {
          alert: {
            ...mockAlert,
            phase: 'PHASE_1_IMMEDIATE',
          },
          onDismiss: vi.fn(),
          flashEnabled: false,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const phase1Section = container.querySelector('section');
      expect(phase1Section).toBeTruthy();
      expect(phase1Section?.getAttribute('role')).toBe('alert');
      expect(phase1Section?.getAttribute('aria-live')).toBe('assertive');

      // Phase 2: enriched AI update
      root.render(
        React.createElement(ResidentAlert, {
          alert: {
            ...mockAlert,
            phase: 'PHASE_2_ENRICHED',
            body: 'Delivery driver carrying a medium cardboard box.',
          },
          onDismiss: vi.fn(),
          flashEnabled: false,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const phase2Section = container.querySelector('section');
      expect(phase2Section).toBeTruthy();
      expect(phase2Section?.getAttribute('role')).toBe('status');
      expect(phase2Section?.getAttribute('aria-live')).toBe('polite');
    });

    it('enforces minimum 24px typography for alert text and polite live region', async () => {
      const root = createRoot(container);
      root.render(
        React.createElement(ResidentAlert, {
          alert: mockAlert,
          onDismiss: vi.fn(),
          flashEnabled: false,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const titleEl = container.querySelector('h2') as HTMLElement;
      expect(titleEl).toBeTruthy();
      // Font size must be var(--text-2xl) (32px) or >= 24px
      expect(titleEl.style.fontSize).toMatch(/(var\(--text-(2xl|3xl|xl)\)|24px|32px|2rem)/);

      const bodyEl = container.querySelector('p[aria-live="polite"]') as HTMLElement;
      expect(bodyEl).toBeTruthy();
      // Font size must be var(--text-xl) (24px) or >= 24px
      expect(bodyEl.style.fontSize).toMatch(/(var\(--text-xl\)|24px|1\.5rem)/);
      expect(bodyEl.textContent).toBe('Someone is at your door');
    });

    it('ensures dismiss button meets touch target sizing >= 44px', async () => {
      const root = createRoot(container);
      root.render(
        React.createElement(ResidentAlert, {
          alert: mockAlert,
          onDismiss: vi.fn(),
          flashEnabled: false,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const dismissBtn = container.querySelector('button') as HTMLButtonElement;
      expect(dismissBtn).toBeTruthy();
      expect(dismissBtn.textContent).toMatch(/dismiss/i);
      expect(dismissBtn.style.minHeight).toMatch(/(44px|48px)/);
    });
  });

  describe('5. WCAG 2.1 AA Contrast Ratio Calculations', () => {
    function getLuminance(r8: number, g8: number, b8: number): number {
      const [rs, gs, bs] = [r8, g8, b8].map((c) => {
        const val = c / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function getContrastRatio(
      rgb1: [number, number, number],
      rgb2: [number, number, number]
    ): number {
      const l1 = getLuminance(...rgb1);
      const l2 = getLuminance(...rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it('verifies primary background vs white text exceeds WCAG AAA (7.0:1)', () => {
      const bgPrimary: [number, number, number] = [10, 14, 23]; // #0a0e17
      const textPrimary: [number, number, number] = [255, 255, 255]; // #ffffff
      const ratio = getContrastRatio(bgPrimary, textPrimary);
      expect(ratio).toBeGreaterThan(15.0); // ~19.3:1
    });

    it('verifies alert urgent background (#450a0a) vs white text exceeds WCAG AAA (7.0:1)', () => {
      const alertBg: [number, number, number] = [69, 10, 10]; // #450a0a
      const textLight: [number, number, number] = [248, 250, 252]; // #f8fafc
      const ratio = getContrastRatio(alertBg, textLight);
      expect(ratio).toBeGreaterThan(10.0); // ~16.2:1
    });

    it('verifies surface background (#141c2e) vs secondary text (#cbd5e1) exceeds WCAG AA (4.5:1)', () => {
      const surfaceBg: [number, number, number] = [20, 28, 46]; // #141c2e
      const textSecondary: [number, number, number] = [203, 213, 225]; // #cbd5e1
      const ratio = getContrastRatio(surfaceBg, textSecondary);
      expect(ratio).toBeGreaterThan(8.0); // ~8.5:1
    });

    it('verifies button accent cyan (#06b6d4) vs black text (#000000) exceeds WCAG AAA (7.0:1)', () => {
      const cyanAccent: [number, number, number] = [6, 182, 212]; // #06b6d4
      const blackText: [number, number, number] = [0, 0, 0];
      const ratio = getContrastRatio(cyanAccent, blackText);
      expect(ratio).toBeGreaterThan(7.0); // ~8.8:1
    });
  });

  describe('6. Automated axe-core Accessibility Audit', () => {
    it('passes axe-core accessibility checks on ResidentAlert', async () => {
      const root = createRoot(container);
      root.render(
        React.createElement(ResidentAlert, {
          alert: {
            eventId: 'evt-axe-01',
            phase: 'PHASE_1_IMMEDIATE',
            title: 'Doorbell Alert',
            body: 'Someone is at your door',
            timestamp: new Date().toISOString(),
            timeoutFallback: false,
          },
          onDismiss: vi.fn(),
          flashEnabled: false,
          onSendReply: vi.fn(),
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const results = await axe.run(container, {
        rules: {
          'color-contrast': { enabled: false },
        },
      });

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(criticalViolations).toEqual([]);
    });

    it('passes axe-core accessibility checks on FlashToggle', async () => {
      const root = createRoot(container);
      root.render(React.createElement(FlashToggle, { enabled: true, onToggle: vi.fn() }));
      await new Promise((r) => setTimeout(r, 20));

      const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false } },
      });

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(criticalViolations).toEqual([]);
    });

    it('passes axe-core accessibility checks on QuickReplies', async () => {
      const root = createRoot(container);
      root.render(
        React.createElement(QuickReplies, {
          eventId: 'evt-axe-qr-01',
          onSendReply: vi.fn(),
          deliveredReply: null,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false } },
      });

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(criticalViolations).toEqual([]);
    });

    it('passes axe-core accessibility checks on VisitorScreen', async () => {
      const root = createRoot(container);
      root.render(
        React.createElement(VisitorScreen, {
          currentReply: { reply: 'Leave it at the door', timestamp: new Date().toISOString() },
          isConnected: true,
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false } },
      });

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      expect(criticalViolations).toEqual([]);
    });
  });
});
