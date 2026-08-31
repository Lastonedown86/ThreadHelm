import type { StreamFailure, StreamPort } from './stream.js';

export interface TerminalHooks {
  isSelected(sessionId: string): boolean;
  onOutput(sessionId: string): void;
  onTruncated(sessionId: string, count: number): void;
  onStreamFailure(
    sessionId: string,
    reason: StreamFailure | 'TERMINAL_LOAD_FAILED' | 'SUBSCRIPTION_FAILED',
  ): void;
  onInputRejected(sessionId: string, code: string): void;
}

export interface TerminalRuntime {
  setTerminalHooks(hooks: TerminalHooks | null): void;
  attachStream(sessionId: string, port: StreamPort): void;
  closeStream(sessionId: string): void;
  terminalSize(sessionId: string): { columns: number; rows: number } | undefined;
  disposeTerminal(sessionId: string): void;
  disposeTerminals(): void;
}

/** Owns subscriptions, but no xterm imports, byte buffers, timers, or ACKs. */
export class TerminalController {
  readonly #loadRuntime: () => Promise<TerminalRuntime>;
  readonly #requestOutput: (sessionId: string) => Promise<unknown>;
  readonly #subscriptions = new Map<string, { port: StreamPort | null }>();
  #hooks: TerminalHooks | null = null;
  #runtime: TerminalRuntime | null = null;
  #loading: Promise<TerminalRuntime> | null = null;

  constructor(
    loadRuntime: () => Promise<TerminalRuntime>,
    requestOutput: (sessionId: string) => Promise<unknown>,
  ) {
    this.#loadRuntime = loadRuntime;
    this.#requestOutput = requestOutput;
  }

  install(hooks: TerminalHooks): () => void {
    this.#hooks = hooks;
    this.#runtime?.setTerminalHooks(hooks);
    return () => {
      if (this.#hooks !== hooks) return;
      this.#hooks = null;
      for (const subscription of this.#subscriptions.values()) subscription.port?.close();
      this.#subscriptions.clear();
      this.#runtime?.setTerminalHooks(null);
      this.#runtime?.disposeTerminals();
    };
  }

  load(): Promise<TerminalRuntime> {
    if (this.#loading) return this.#loading;
    this.#loading = this.#loadRuntime()
      .then((runtime) => {
        this.#runtime = runtime;
        runtime.setTerminalHooks(this.#hooks);
        for (const [sessionId, subscription] of this.#subscriptions) {
          if (subscription.port) this.#attach(sessionId, subscription.port);
        }
        return runtime;
      })
      .catch(() => {
        this.#loading = null;
        for (const [sessionId, subscription] of this.#subscriptions) {
          subscription.port?.close();
          this.#hooks?.onStreamFailure(sessionId, 'TERMINAL_LOAD_FAILED');
        }
        this.#subscriptions.clear();
        // Import URLs and thrown module values never become user-visible diagnostics.
        throw new Error('TERMINAL_LOAD_FAILED');
      });
    return this.#loading;
  }

  subscribe(sessionId: string): void {
    if (!this.#hooks || this.#subscriptions.has(sessionId)) return;
    const subscription = { port: null as StreamPort | null };
    this.#subscriptions.set(sessionId, subscription);
    void this.load().catch(() => undefined);
    // Register before requesting: the transferred port may precede the IPC reply.
    void this.#requestOutput(sessionId).catch(() => {
      if (this.#subscriptions.get(sessionId) !== subscription) return;
      subscription.port?.close();
      this.#subscriptions.delete(sessionId);
      this.#runtime?.closeStream(sessionId);
      this.#hooks?.onStreamFailure(sessionId, 'SUBSCRIPTION_FAILED');
    });
  }

  receivePort(sessionId: string, port: StreamPort): void {
    const subscription = this.#subscriptions.get(sessionId);
    if (!this.#hooks || !subscription) {
      port.close();
      return;
    }
    subscription.port?.close();
    subscription.port = port;
    if (this.#runtime) this.#attach(sessionId, port);
    // Do not start the port while loading. The existing host window bounds the
    // queued output; StreamClient starts delivery and ACKs only after xterm writes.
  }

  terminalSize(sessionId: string): { columns: number; rows: number } | undefined {
    return this.#runtime?.terminalSize(sessionId);
  }

  #attach(sessionId: string, port: StreamPort): void {
    try {
      this.#runtime!.attachStream(sessionId, port);
      this.#subscriptions.get(sessionId)!.port = null;
    } catch {
      port.close();
      this.#subscriptions.delete(sessionId);
      this.#runtime?.disposeTerminal(sessionId);
      this.#hooks?.onStreamFailure(sessionId, 'TERMINAL_LOAD_FAILED');
    }
  }
}
