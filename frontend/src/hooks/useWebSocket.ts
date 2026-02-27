/* ===================================================================
   Nexus AI OS — useWebSocket Hook
   Auto-connect/disconnect on mount/unmount, channel subscriptions
   =================================================================== */

import { useEffect, useRef, useCallback } from 'react';
import nexusWs, { type WsChannel, type WsEventMap, type WsEventName } from '@/lib/websocket';

interface UseWebSocketOptions {
  /** Channels to subscribe to on mount */
  channels?: WsChannel[];
  /** Auto-connect on mount (default true) */
  autoConnect?: boolean;
}

/**
 * React hook that manages the Nexus WS lifecycle per-component.
 *
 * ```tsx
 * const { send, on } = useWebSocket({ channels: ['chat', 'system'] });
 *
 * useEffect(() => {
 *   return on('chat:message', (data) => { ... });
 * }, [on]);
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { channels = [], autoConnect = true } = options;
  const cleanups = useRef<(() => void)[]>([]);

  /* ---- Connect & subscribe on mount ---- */
  useEffect(() => {
    if (autoConnect && !nexusWs.isConnected && !nexusWs.isConnecting) {
      nexusWs.connect();
    }

    channels.forEach((ch) => nexusWs.subscribe(ch));

    return () => {
      channels.forEach((ch) => nexusWs.unsubscribe(ch));
      cleanups.current.forEach((fn) => fn());
      cleanups.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, ...channels]);

  /* ---- Typed event listener ---- */
  const on = useCallback(<K extends WsEventName>(
    event: K,
    handler: (data: WsEventMap[K]) => void,
  ) => {
    const unsub = nexusWs.on(event, handler);
    cleanups.current.push(unsub);
    return unsub;
  }, []);

  /* ---- Send helper ---- */
  const send = useCallback((channel: WsChannel, event: string, data?: unknown) => {
    nexusWs.send(channel, event, data);
  }, []);

  /* ---- Connection controls ---- */
  const connect = useCallback(() => nexusWs.connect(), []);
  const disconnect = useCallback(() => nexusWs.disconnect(), []);

  return {
    on,
    send,
    connect,
    disconnect,
    isConnected: nexusWs.isConnected,
    isConnecting: nexusWs.isConnecting,
  } as const;
}

export default useWebSocket;
