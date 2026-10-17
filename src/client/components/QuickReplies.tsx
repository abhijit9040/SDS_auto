import React from 'react';
import { ALLOWED_QUICK_REPLIES, QuickReplyText } from '../../shared/types.js';

interface QuickRepliesProps {
  eventId: string;
  onSendReply: (reply: QuickReplyText) => void;
  isPending?: boolean;
  deliveredReply?: string | null;
}

export const QuickReplies: React.FC<QuickRepliesProps> = ({
  onSendReply,
  isPending = false,
  deliveredReply = null,
}) => {
  return (
    <section
      aria-label="Quick Replies"
      style={{
        marginTop: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <h3
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '0.25rem',
        }}
      >
        Send Quick Reply to Visitor
      </h3>

      <div
        role="group"
        aria-label="One-tap reply options"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {ALLOWED_QUICK_REPLIES.map((replyText) => {
          const isDelivered = deliveredReply === replyText;

          return (
            <button
              key={replyText}
              type="button"
              disabled={isPending || Boolean(deliveredReply)}
              onClick={() => onSendReply(replyText)}
              className="quick-reply-btn"
              style={{
                minHeight: '48px', // Accessibility: >=48px touch target
                padding: '0.75rem 1rem',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
                color: isDelivered ? '#000000' : '#ffffff',
                backgroundColor: isDelivered ? 'var(--alert-success)' : 'rgba(255, 255, 255, 0.1)',
                border: isDelivered ? '2px solid var(--alert-success)' : '2px solid #ffffff',
                borderRadius: '8px',
                cursor: isPending || deliveredReply ? 'default' : 'pointer',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: isDelivered ? '0 0 12px rgba(34, 197, 94, 0.4)' : 'none',
              }}
            >
              {isDelivered ? `✓ ${replyText}` : replyText}
            </button>
          );
        })}
      </div>

      {deliveredReply && (
        <p
          role="status"
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--alert-success)',
            fontWeight: 700,
            marginTop: '0.5rem',
          }}
        >
          ✓ Delivered to visitor screen at {new Date().toLocaleTimeString()}
        </p>
      )}

      {isPending && (
        <p
          role="status"
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--accent-cyan)',
            fontWeight: 700,
            marginTop: '0.5rem',
          }}
        >
          Sending reply to visitor...
        </p>
      )}
    </section>
  );
};
