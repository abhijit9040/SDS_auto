import { RingAdapter } from './ring-adapter.interface.js';
import { VisitorEvent, RingSnapshotResult } from '../../shared/types.js';
import { RingRestClient, RingRestClientOptions } from '../services/ring-rest-client.js';

export interface RingApiAdapterOptions extends RingRestClientOptions {
  token?: string;
  baseUrl?: string;
}

export class RingApiAdapter implements RingAdapter {
  private readonly client: RingRestClient;
  private readonly token?: string;
  private readonly listeners: ((event: VisitorEvent) => void | Promise<void>)[] = [];

  constructor(options: RingApiAdapterOptions = {}) {
    this.token = options.token;
    this.client = new RingRestClient({
      baseUrl: options.baseUrl || 'https://api.amazonvision.com',
      token: options.token,
      timeoutMs: options.timeoutMs ?? 5000,
      maxRetries: options.maxRetries ?? 3,
    });
  }

  /**
   * Initializes the RingApiAdapter.
   * Throws a clear, descriptive startup error if initialized without a Bearer token.
   */
  public async initialize(): Promise<void> {
    if (!this.token || this.token.trim() === '') {
      throw new Error(
        "Startup Error [RingApiAdapter]: RING_MODE is set to 'live' but RING_API_TOKEN is missing or empty. " +
          'Provide a valid Ring Partner API Bearer token via the RING_API_TOKEN environment variable, ' +
          'or set RING_MODE=emulator to use the local/sandbox emulator.'
      );
    }
  }

  public onVisitorEvent(handler: (event: VisitorEvent) => void | Promise<void>): void {
    this.listeners.push(handler);
  }

  /**
   * Dispatches an incoming event to registered listeners
   */
  public async emitVisitorEvent(event: VisitorEvent): Promise<void> {
    for (const listener of this.listeners) {
      await listener(event);
    }
  }

  /**
   * Retrieves an image snapshot for a given doorbell device
   */
  public async fetchVisitorSnapshot(
    deviceId: string,
    timestamp?: number
  ): Promise<RingSnapshotResult> {
    return this.client.downloadSnapshot(deviceId, {
      type: timestamp ? 'at_timestamp' : 'latest_in_range',
      timestamp,
      format: 'jpeg',
    });
  }

  /**
   * Exposes the underlying REST client for device discovery and health checks
   */
  public getRestClient(): RingRestClient {
    return this.client;
  }
}
