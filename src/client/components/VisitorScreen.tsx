import React from 'react';

export interface VisitorReplyData {
  reply: string;
  timestamp: string;
}

interface VisitorScreenProps {
  currentReply: VisitorReplyData | null;
  isConnected?: boolean;
}

export const VisitorScreen: React.FC<VisitorScreenProps> = ({
  currentReply,
  isConnected = true,
}) => {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0e17',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {/* Header Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          borderRadius: '9999px',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          fontSize: 'var(--text-sm)',
          marginBottom: '2.5rem',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 800,
            color: isConnected ? 'var(--alert-success)' : 'var(--alert-urgent)',
          }}
        >
          {isConnected ? '✓' : '✕'}
        </span>
        <span style={{ fontWeight: 600 }}>
          {isConnected ? 'Doorbell Display Active' : 'Connecting to Doorbell...'}
        </span>
      </div>

      {/* Main Display Container */}
      <section
        aria-live="polite"
        style={{
          maxWidth: '750px',
          width: '100%',
          padding: '3rem 2rem',
          borderRadius: '16px',
          backgroundColor: currentReply ? '#0f172a' : '#141c2e',
          border: currentReply ? '3px solid var(--accent-cyan)' : '2px dashed #475569',
          boxShadow: currentReply ? '0 10px 40px rgba(6, 182, 212, 0.25)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {currentReply ? (
          <div>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                fontWeight: 800,
                color: 'var(--accent-cyan)',
                display: 'block',
                marginBottom: '1rem',
              }}
            >
              Message from Resident
            </span>

            <h1
              style={{
                fontSize: 'var(--text-3xl)', // >= 40px
                fontWeight: 800,
                lineHeight: 1.25,
                color: '#ffffff',
                marginBottom: '1.5rem',
              }}
            >
              &ldquo;{currentReply.reply}&rdquo;
            </h1>

            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
              Received at {new Date(currentReply.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ) : (
          <div>
            <h1
              style={{
                fontSize: 'var(--text-2xl)', // >= 32px
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              Waiting for response...
            </h1>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
              The resident has been notified visually. Please wait a moment.
            </p>
          </div>
        )}
      </section>

      {/* Footer Branding */}
      <footer style={{ marginTop: '3rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        SignalDoor Accessible Smart Doorbell System
      </footer>
    </main>
  );
};
