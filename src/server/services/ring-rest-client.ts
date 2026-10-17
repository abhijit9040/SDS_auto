import { RingDevice, RingSnapshotOptions, RingSnapshotResult } from '../../shared/types.js';

// ============================================================================
// Ring Partner API Error Hierarchy
// ============================================================================

export class RingApiError extends Error {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message);
    this.name = 'RingApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/** 401 Unauthorized: Invalid, expired, or missing Bearer token */
export class RingAuthError extends RingApiError {
  constructor(
    message = 'Unauthorized: Invalid or expired Ring API Bearer token',
    endpoint?: string
  ) {
    super(message, 401, endpoint);
    this.name = 'RingAuthError';
  }
}

/** 403 Forbidden: Insufficient OAuth scope or access denied */
export class RingForbiddenError extends RingApiError {
  constructor(message = 'Forbidden: Access denied to Ring resource', endpoint?: string) {
    super(message, 403, endpoint);
    this.name = 'RingForbiddenError';
  }
}

/** 404 Not Found: Device or media resource does not exist */
export class RingNotFoundError extends RingApiError {
  constructor(message = 'Not Found: Ring resource not found', endpoint?: string) {
    super(message, 404, endpoint);
    this.name = 'RingNotFoundError';
  }
}

/** 429 Too Many Requests: Rate limit exceeded */
export class RingRateLimitError extends RingApiError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message = 'Rate Limit Exceeded: Too many requests to Ring Partner API',
    retryAfterSeconds?: number,
    endpoint?: string
  ) {
    super(message, 429, endpoint);
    this.name = 'RingRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Request Timeout (AbortController) */
export class RingTimeoutError extends RingApiError {
  constructor(
    message = 'Request timed out waiting for Ring Partner API response',
    endpoint?: string
  ) {
    super(message, 408, endpoint);
    this.name = 'RingTimeoutError';
  }
}

// ============================================================================
// Client Options & Implementation
// ============================================================================

export interface RingRestClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export class RingRestClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(options: RingRestClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'https://api.amazonvision.com').replace(/\/+$/, '');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
  }

  /**
   * List Ring Devices
   * Official Doc: https://developer.amazon.com/docs/ring/devices-api.html#list-devices
   * Endpoint: GET /v1/devices
   * Standard: JSON:API specification
   */
  public async listDevices(): Promise<RingDevice[]> {
    const endpoint = '/v1/devices';
    const json = await this.requestJson<{ data: RingDevice[] }>(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json, application/json',
      },
    });

    if (!Array.isArray(json?.data)) {
      throw new RingApiError(
        'Malformed JSON:API response from /v1/devices: missing data array',
        500,
        endpoint
      );
    }

    return json.data;
  }

  /**
   * Get Single Ring Device Details
   * Official Doc: https://developer.amazon.com/docs/ring/devices-api.html#get-device
   * Endpoint: GET /v1/devices/{deviceId}
   * Standard: JSON:API specification
   */
  public async getDevice(deviceId: string): Promise<RingDevice> {
    const endpoint = `/v1/devices/${encodeURIComponent(deviceId)}`;
    const json = await this.requestJson<{ data: RingDevice }>(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json, application/json',
      },
    });

    if (!json?.data || typeof json.data !== 'object') {
      throw new RingApiError(
        `Malformed JSON:API response from ${endpoint}: missing data object`,
        500,
        endpoint
      );
    }

    return json.data;
  }

  /**
   * Download Image Snapshot (JPEG/PNG)
   * Official Doc: https://developer.amazon.com/docs/ring/media-api.html#download-image-snapshot
   * Endpoint: POST /v1/devices/{deviceId}/media/image/download
   * Note: Binary snapshot retrieval with X-Media-Timestamp header
   */
  public async downloadSnapshot(
    deviceId: string,
    options: RingSnapshotOptions = {}
  ): Promise<RingSnapshotResult> {
    const endpoint = `/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`;

    const requestBody: Record<string, unknown> = {
      type: options.type || (options.timestamp ? 'at_timestamp' : 'latest_in_range'),
      image_options: {
        format: options.format || 'jpeg',
      },
    };

    if (requestBody.type === 'at_timestamp') {
      requestBody.timestamp = options.timestamp ?? Date.now();
    } else {
      requestBody.start_timestamp = options.startTimestamp ?? Date.now() - 30_000;
      if (options.endTimestamp) {
        requestBody.end_timestamp = options.endTimestamp;
      }
    }

    if (options.width && options.height) {
      (requestBody.image_options as Record<string, unknown>).resolution = {
        width: options.width,
        height: options.height,
      };
    }

    if (options.componentId) {
      requestBody.components = [{ component_id: options.componentId }];
    }

    const response = await this.executeWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'image/jpeg, image/png, */*',
      },
      body: JSON.stringify(requestBody),
    });

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || `image/${options.format || 'jpeg'}`;
    const rawTimestamp = response.headers.get('x-media-timestamp');
    const timestamp = rawTimestamp ? parseInt(rawTimestamp, 10) : undefined;

    return {
      imageBuffer,
      contentType,
      timestamp,
    };
  }

  // ============================================================================
  // Private HTTP Execution with Exponential Backoff & 429 Handling
  // ============================================================================

  private async requestJson<T>(endpoint: string, init: RequestInit): Promise<T> {
    const response = await this.executeWithRetry(endpoint, init);
    try {
      return (await response.json()) as T;
    } catch (err) {
      throw new RingApiError(
        `Failed to parse JSON response from ${endpoint}: ${String(err)}`,
        response.status,
        endpoint
      );
    }
  }

  private async executeWithRetry(endpoint: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const headers: Record<string, string> = {
        ...(init.headers as Record<string, string>),
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          return response;
        }

        // Distinct Error Handling
        if (response.status === 401) {
          throw new RingAuthError(
            `Unauthorized (401) on ${endpoint}: Token invalid or expired`,
            endpoint
          );
        }

        if (response.status === 403) {
          throw new RingForbiddenError(
            `Forbidden (403) on ${endpoint}: Insufficient OAuth scopes`,
            endpoint
          );
        }

        if (response.status === 404) {
          throw new RingNotFoundError(
            `Not Found (404) on ${endpoint}: Resource does not exist`,
            endpoint
          );
        }

        if (response.status === 429) {
          attempt++;
          if (attempt > this.maxRetries) {
            const retryHeader = response.headers.get('retry-after');
            const retrySec = retryHeader ? parseInt(retryHeader, 10) : undefined;
            throw new RingRateLimitError(
              `Rate Limit Exceeded (429) on ${endpoint} after ${this.maxRetries} retries`,
              retrySec,
              endpoint
            );
          }

          // Respect Retry-After header or use exponential backoff starting at initialBackoffMs (1s)
          const retryAfterHeader = response.headers.get('retry-after');
          let delayMs = this.initialBackoffMs * Math.pow(2, attempt - 1);

          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              delayMs = parsedSeconds * 1000;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw new RingApiError(
          `Ring API error HTTP ${response.status} on ${endpoint}`,
          response.status,
          endpoint
        );
      } catch (err) {
        clearTimeout(timer);

        if (err instanceof RingApiError) {
          throw err;
        }

        if (
          err instanceof Error &&
          (err.name === 'AbortError' || err.message.includes('aborted'))
        ) {
          throw new RingTimeoutError(
            `Timeout after ${this.timeoutMs}ms calling Ring API on ${endpoint}`,
            endpoint
          );
        }

        throw new RingApiError(
          `Network failure calling Ring API on ${endpoint}: ${String(err)}`,
          undefined,
          endpoint
        );
      }
    }

    throw new RingApiError(
      `Exceeded maximum retries (${this.maxRetries}) on ${endpoint}`,
      500,
      endpoint
    );
  }
}
