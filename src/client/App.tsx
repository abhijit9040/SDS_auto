import React, { useState } from 'react';
import { useDoorbellSocket } from './hooks/useDoorbellSocket.js';
import { ResidentAlert } from './components/ResidentAlert.js';

export const App: React.FC = () => {
  const { currentAlert, isConnected, clearAlert } = useDoorbellSocket('resident');
  const [triggerStatus, setTriggerStatus] = useState<string>('');

  const handleSimulateDoorbell = async () => {
    setTriggerStatus('Triggering simulator...');
    try {
      const res = await fetch('/api/simulator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'front-doorbell' }),
      });
      const data = await res.json();
      if (res.ok) {
        setTriggerStatus(`Event sent (Request ID: ${data.requestId})`);
      } else {
        setTriggerStatus(`Trigger failed: ${data.error}`);
      }
    } catch (err) {
      setTriggerStatus(`Error: ${String(err)}`);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--text-primary)' }}
          >
            SignalDoor
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
            Deaf-friendly smart doorbell interface
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            backgroundColor: 'var(--bg-surface)',
            border: 'var(--border-subtle)',
            fontSize: 'var(--text-sm)',
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--alert-success)' : 'var(--alert-urgent)',
            }}
          />
          <span>{isConnected ? 'Doorbell Connected' : 'Connecting...'}</span>
        </div>
      </header>

      {/* Simulator Control Panel */}
      <section
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '8px',
          border: 'var(--border-subtle)',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: '0.5rem' }}>
          Simulator Controls (Hackathon Dev)
        </h2>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
          }}
        >
          Simulate a Ring doorbell press signed with HMAC-SHA256 to verify end-to-end alert
          delivery.
        </p>
        <button
          onClick={handleSimulateDoorbell}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            backgroundColor: 'var(--accent-cyan)',
            color: '#000000',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          🔔 Trigger Doorbell Press
        </button>
        {triggerStatus && (
          <p
            style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
          >
            {triggerStatus}
          </p>
        )}
      </section>

      {/* Active Visual Alert */}
      {currentAlert && (
        <ResidentAlert alert={currentAlert} onDismiss={clearAlert} flashEnabled={true} />
      )}

      {/* Idle Status Display */}
      {!currentAlert && (
        <section
          style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '8px',
            border: 'var(--border-subtle)',
            marginTop: '1.5rem',
          }}
        >
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-muted)' }}>
            Listening for visitor events. When a visitor presses the doorbell, an immediate visual
            alert will appear here.
          </p>
        </section>
      )}
    </main>
  );
};
