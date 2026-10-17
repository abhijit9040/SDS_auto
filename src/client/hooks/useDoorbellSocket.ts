import { useEffect, useState, useRef, useCallback } from 'react';
import {
  AlertPayload,
  WebSocketServerMessage,
  WebSocketClientMessage,
  QuickReplyText,
} from '../../shared/types.js';

export interface UseDoorbellSocketReturn {
  currentAlert: AlertPayload | null;
  currentReply: { reply: string; timestamp: string } | null;
  deliveredReply: string | null;
  isConnected: boolean;
  clearAlert: () => void;
  sendQuickReply: (reply: QuickReplyText) => void;
}

export function useDoorbellSocket(
  role: 'resident' | 'visitor' = 'resident'
): UseDoorbellSocketReturn {
  const [currentAlert, setCurrentAlert] = useState<AlertPayload | null>(null);
  const [currentReply, setCurrentReply] = useState<{ reply: string; timestamp: string } | null>(
    null
  );
  const [deliveredReply, setDeliveredReply] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      const subMsg: WebSocketClientMessage = { type: 'SUBSCRIBE', role };
      ws.send(JSON.stringify(subMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WebSocketServerMessage;
        if (msg.type === 'ALERT_PHASE_1') {
          setCurrentAlert(msg.payload);
          // New alert clears previous reply on both resident and visitor screens
          setDeliveredReply(null);
          setCurrentReply(null);
        } else if (msg.type === 'ALERT_PHASE_2') {
          setCurrentAlert(msg.payload);
        } else if (msg.type === 'VISITOR_REPLY_DISPLAY') {
          setCurrentReply(msg.payload);
        } else if (msg.type === 'REPLY_ACK') {
          setDeliveredReply((prev) => prev); // Confirmed delivered
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
    setDeliveredReply(null);
  }, []);

  const sendQuickReply = useCallback(
    (reply: QuickReplyText) => {
      if (!currentAlert || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      setDeliveredReply(reply);
      const msg: WebSocketClientMessage = {
        type: 'QUICK_REPLY',
        payload: {
          eventId: currentAlert.eventId,
          reply,
          timestamp: new Date().toISOString(),
        },
      };
      wsRef.current.send(JSON.stringify(msg));
    },
    [currentAlert]
  );

  return {
    currentAlert,
    currentReply,
    deliveredReply,
    isConnected,
    clearAlert,
    sendQuickReply,
  };
}
