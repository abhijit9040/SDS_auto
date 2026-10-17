import React from 'react';
import { AlertPayload, QuickReplyText } from '../../shared/types.js';
import { QuickReplies } from './QuickReplies.js';

interface ResidentAlertProps {
  alert: AlertPayload;
  onDismiss: () => void;
  flashEnabled?: boolean;
  onSendReply?: (reply: QuickReplyText) => void;
  deliveredReply?: string | null;
}

export const ResidentAlert: React.FC<ResidentAlertProps> = ({
  alert,
  onDismiss,
  flashEnabled = true,
  onSendReply,
  deliveredReply = null,
}) => {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className={flashEnabled ? 'strobe-alert' : ''}
      style={{
        padding: '2rem',
        borderRadius: '12px',
        border: '3px solid var(--alert-urgent)',
        backgroundColor: 'var(--alert-urgent-bg)',
        color: 'var(--text-primary)',
        marginTop: '1.5rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            color: 'var(--accent-cyan)',
          }}
        >
          {alert.phase === 'PHASE_1_IMMEDIATE'
            ? '⚡ Visual Doorbell Alert'
            : '✨ Bedrock AI Summary'}
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {new Date(alert.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2
        style={{
          fontSize: 'var(--text-2xl)', // >= 24px (32px)
          fontWeight: 800,
          marginTop: '0.75rem',
          marginBottom: '0.5rem',
          lineHeight: 1.2,
          color: '#ffffff',
        }}
      >
        {alert.title}
      </h2>

      {/* Alert text updates announced politely to assistive technologies */}
      <p
        aria-live="polite"
        style={{
          fontSize: 'var(--text-xl)', // 24px minimum font size
          fontWeight: 600,
          lineHeight: 1.4,
          color: '#f8fafc',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          padding: '1rem',
          borderRadius: '8px',
          borderLeft: '4px solid var(--accent-cyan)',
        }}
      >
        {alert.body}
      </p>

      {/* Two-Way Quick Replies */}
      {onSendReply && (
        <QuickReplies
          eventId={alert.eventId}
          onSendReply={onSendReply}
          deliveredReply={deliveredReply}
        />
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button
          type="button"
          onClick={onDismiss}
          className="dismiss-alert-btn"
          style={{
            minHeight: '48px', // Accessible touch target >= 48px
            padding: '0.75rem 1.75rem',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            borderRadius: '8px',
            border: '2px solid #ffffff',
            backgroundColor: 'transparent',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>✕</span>
          <span>Dismiss Alert</span>
        </button>
      </div>
    </section>
  );
};
