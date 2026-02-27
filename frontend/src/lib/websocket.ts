/* ===================================================================
   Nexus AI OS — WebSocket Client
   Auto-reconnect, typed events, heartbeat, offline queue
   =================================================================== */

/* ------------------------------------------------------------------ */
/*  Event types                                                        */
/* ------------------------------------------------------------------ */

export type WsChannel = 'chat' | 'home' | 'system' | 'notifications' | 'voice';

export interface WsEvent<T = unknown> {
  channel: WsChannel;
  event: string;
  data: T;
  timestamp: string;
}

export interface WsChatMessage {
  conversation_id: string;
  role: 'assistant' | 'system';
  content: string;
  agent?: string;
}

export interface WsHomeUpdate {
  device_id: string;
  field: string;
  value: unknown;
}

export interface WsSystemAlert {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface WsNotification {
  id: string;
  type: string;
  title: string;
  body: string;
}

export interface WsVoiceChunk {
  type: 'transcript' | 'audio';
  data: string; // text or base64 audio
  is_final: boolean;
}

export type WsEventMap = {
  'chat:message': WsChatMessage;
  'chat:typing': { conversation_id: string; agent: string };
  'chat:stop': { conversation_id: string };
  'home:device_update': WsHomeUpdate;
  'home:sensor_reading': { sensor_id: string; value: number };
  'home:alert': { device_id: string; message: string };
  'system:resources': { cpu: number; memory: number; disk: number };
  'system:alert': WsSystemAlert;
  'system:agent_status': { agent: string; status: string };
  'notifications:new': WsNotification;
  'notifications:dismissed': { id: string };
  'voice:transcript': WsVoiceChunk;
  'voice:response': WsVoiceChunk;
};

export type WsEventName = keyof WsEventMap;
type Handler<T = unknown> = (data: T) => void;

/* ------------------------------------------------------------------ */
/*  WebSocket Manager                                                  */
/* ------------------------------------------------------------------ */

export class NexusWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<Handler>>();
  private subscriptions = new Set<WsChannel>();
  private messageQueue: string[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 30_000;
  private _isConnected = false;
  private _isConnecting = false;
  private intentionalClose = false;

  constructor(url?: string) {
    const wsBase = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}`;
    this.url = url ?? `${wsBase}/ws`;
  }

  /* ---- Connection state ---- */
  get isConnected() { return this._isConnected; }
  get isConnecting() { return this._isConnecting; }

  /* ---- Connect ---- */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.intentionalClose = false;
    this._isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._isConnected = true;
        this._isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('[Nexus WS] connected');

        // Re-subscribe to channels
        this.subscriptions.forEach((ch) => this.sendRaw({ type: 'subscribe', channel: ch }));

        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift()!;
          this.ws?.send(msg);
        }

        this.startHeartbeat();
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data as string) as WsEvent;
          if (parsed.event === 'pong') return; // heartbeat ack

          const key = `${parsed.channel}:${parsed.event}`;
          this.handlers.get(key)?.forEach((fn) => fn(parsed.data));
          // Also fire wildcard listeners
          this.handlers.get('*')?.forEach((fn) => fn(parsed));
        } catch {
          console.warn('[Nexus WS] unparseable message', ev.data);
        }
      };

      this.ws.onclose = (ev) => {
        this._isConnected = false;
        this._isConnecting = false;
        this.stopHeartbeat();
        this.emit('connection', { status: 'disconnected', code: ev.code });

        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.emit('connection', { status: 'error' });
      };
    } catch (err) {
      this._isConnecting = false;
      console.error('[Nexus WS] connection error', err);
      this.scheduleReconnect();
    }
  }

  /* ---- Disconnect ---- */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, 'client disconnect');
    this.ws = null;
    this._isConnected = false;
    this._isConnecting = false;
  }

  /* ---- Subscribe / Unsubscribe to channels ---- */
  subscribe(channel: WsChannel): void {
    this.subscriptions.add(channel);
    if (this._isConnected) {
      this.sendRaw({ type: 'subscribe', channel });
    }
  }

  unsubscribe(channel: WsChannel): void {
    this.subscriptions.delete(channel);
    if (this._isConnected) {
      this.sendRaw({ type: 'unsubscribe', channel });
    }
  }

  /* ---- Event listeners ---- */
  on<K extends WsEventName>(event: K, handler: Handler<WsEventMap[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as Handler);
    return () => this.off(event, handler);
  }

  onAny(handler: Handler<WsEvent>): () => void {
    if (!this.handlers.has('*')) this.handlers.set('*', new Set());
    this.handlers.get('*')!.add(handler as Handler);
    return () => { this.handlers.get('*')?.delete(handler as Handler); };
  }

  off<K extends WsEventName>(event: K, handler: Handler<WsEventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  /* ---- Send ---- */
  send(channel: WsChannel, event: string, data: unknown = {}): void {
    const payload = JSON.stringify({ channel, event, data, timestamp: new Date().toISOString() });
    if (this._isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.messageQueue.push(payload);
      if (this.messageQueue.length > 100) this.messageQueue.shift(); // cap queue
    }
  }

  /* ---- Internal helpers ---- */

  private sendRaw(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((fn) => fn(data));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Nexus WS] max reconnect attempts reached');
      this.emit('connection', { status: 'failed' });
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    console.log(`[Nexus WS] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendRaw({ type: 'ping', timestamp: Date.now() });
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/* ---- Singleton instance ---- */
export const nexusWs = new NexusWebSocket();
export default nexusWs;
