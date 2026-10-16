import { useEffect, useState, useRef, useCallback } from 'react';
import { AlertPayload, WebSocketServerMessage } from '../../shared/types.js';

export interface UseDoorbellSocketReturn {
  currentAlert: AlertPayload | null;
  isConnected: boolean;
  clearAlert: () => void;
}

export function useDoorbellSocket(
  role: 'resident' | 'visitor' = 'resident'
): UseDoorbellSocketReturn {
  const [currentAlert, setCurrentAlert] = useState<AlertPayload | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', role }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WebSocketServerMessage;
        if (msg.type === 'ALERT_PHASE_1' || msg.type === 'ALERT_PHASE_2') {
          setCurrentAlert(msg.payload);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [role]);

  const clearAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  return { currentAlert, isConnected, clearAlert };
}
