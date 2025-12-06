import { describe, it, expect, vi } from 'vitest';
import { executePetalflyRequest } from '../httpClient';
import { executeRequest, executeGraphQLRequest, executeWebSocketRequest } from '../tauriBridge';

// Mock the tauri bridge
vi.mock('./tauriBridge', () => ({
  executeRequest: vi.fn(),
  executeGraphQLRequest: vi.fn(),
  executeWebSocketRequest: vi.fn(),
}));

describe('httpClient', () => {
  it('should execute HTTP request', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'success',
      duration_ms: 100,
      size_bytes: 7,
      error: null,
    };

    (executeRequest as any).mockResolvedValue(mockResponse);

    const result = await executePetalflyRequest({
      doc: {
        protocol: 'http',
        request: { method: 'GET', url: 'http://example.com' },
      },
      environment: [],
      globals: [],
      settings: { timeoutMs: 30000, ignoreSsl: false },
    });

    expect(result.response).toEqual(mockResponse);
    expect(executeRequest).toHaveBeenCalled();
  });

  it('should execute GraphQL request', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"data": {}}',
      duration_ms: 150,
      size_bytes: 12,
      error: null,
    };

    (executeGraphQLRequest as any).mockResolvedValue(mockResponse);

    const result = await executePetalflyRequest({
      doc: {
        protocol: 'graphql',
        request: { method: 'POST', url: 'http://example.com/graphql', body: { value: 'query {}' } },
      },
      environment: [],
      globals: [],
      settings: { timeoutMs: 30000, ignoreSsl: false },
    });

    expect(result.response).toEqual(mockResponse);
    expect(executeGraphQLRequest).toHaveBeenCalled();
  });

  it('should execute WebSocket request', async () => {
    const mockResponse = {
      status: 101,
      statusText: 'Switching Protocols',
      headers: {},
      body: '[]',
      duration_ms: 200,
      size_bytes: 2,
      error: null,
    };

    (executeWebSocketRequest as any).mockResolvedValue(mockResponse);

    const result = await executePetalflyRequest({
      doc: {
        protocol: 'websocket',
        request: { method: 'GET', url: 'ws://example.com', body: { value: '[]' } },
      },
      environment: [],
      globals: [],
      settings: { timeoutMs: 30000, ignoreSsl: false },
    });

    expect(result.response).toEqual(mockResponse);
    expect(executeWebSocketRequest).toHaveBeenCalled();
  });
});