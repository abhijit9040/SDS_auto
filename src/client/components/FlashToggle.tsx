import React from 'react';

export const FLASH_STORAGE_KEY = 'signaldoor_flash_enabled';
export const VIBRATE_STORAGE_KEY = 'signaldoor_vibrate_enabled';

export function getInitialFlashPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(FLASH_STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    // Auto-disable if user prefers reduced motion (WCAG 2.3.1)
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
  } catch {
    // localStorage or matchMedia unavailable
  }
  return true;
}

export function saveFlashPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FLASH_STORAGE_KEY, String(enabled));
  } catch {
    // Storage quota or private browsing restriction
  }
}

export interface FlashToggleProps {
  flashEnabled?: boolean;
  enabled?: boolean; // Convenience alias for flashEnabled
  vibrateEnabled?: boolean;
  onToggleFlash?: (enabled: boolean) => void;
  onToggle?: (enabled: boolean) => void; // Convenience alias for onToggleFlash
  onToggleVibrate?: (enabled: boolean) => void;
}

export const FlashToggle: React.FC<FlashToggleProps> = ({
  flashEnabled,
  enabled,
  vibrateEnabled = false,
  onToggleFlash,
  onToggle,
  onToggleVibrate,
}) => {
  const isFlashOn = flashEnabled ?? enabled ?? true;
  const isVibrateOn = vibrateEnabled;

  const handleFlashClick = () => {
    const nextVal = !isFlashOn;
    onToggleFlash?.(nextVal);
    onToggle?.(nextVal);
  };

  const handleVibrateClick = () => {
    const nextVal = !isVibrateOn;
    onToggleVibrate?.(nextVal);
  };

  return (
    <section
      aria-label="Accessibility Settings"
      style={{
        padding: '1rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '8px',
        border: 'var(--border-subtle)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.25rem',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: '#ffffff' }}>
          Accessibility & Sensory Preferences
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          WCAG 2.3.1 compliant flashing safeguards (&le; 2 flashes/sec) and sensory alert toggles.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        {/* Visual Strobe Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isFlashOn ? 'true' : 'false'}
          aria-label="Visual Strobe Alert"
          onClick={handleFlashClick}
          className="accessibility-toggle-btn"
          style={{
            minHeight: '48px', // Touch target >= 48px
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: isFlashOn ? '2px solid var(--accent-cyan)' : '2px solid #64748b',
            backgroundColor: isFlashOn ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
            color: '#ffffff',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span aria-hidden="true">{isFlashOn ? '⚡' : '🚫'}</span>
          <span>Visual Strobe: {isFlashOn ? 'ON' : 'OFF'}</span>
        </button>

        {/* Mobile Vibration Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isVibrateOn ? 'true' : 'false'}
          aria-label="Vibration Alert"
          onClick={handleVibrateClick}
          className="accessibility-toggle-btn"
          style={{
            minHeight: '48px', // Touch target >= 48px
            padding: '0.6rem 1.1rem',
            borderRadius: '8px',
            border: isVibrateOn ? '2px solid var(--alert-success)' : '2px solid #64748b',
            backgroundColor: isVibrateOn ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: '#ffffff',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span aria-hidden="true">{isVibrateOn ? '📳' : '🔇'}</span>
          <span>Vibration: {isVibrateOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </section>
  );
};
