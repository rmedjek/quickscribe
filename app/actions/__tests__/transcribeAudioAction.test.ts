/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';
process.env.GROQ_API_KEY = 'test';

class MockGroq {
  audio = {
    transcriptions: {
      create: jest.fn<
        Promise<{ text: string; segments: unknown[] }>,
        [Record<string, unknown>]
      >(),
    },
  };
}

type MockGroqWithStatics = typeof MockGroq & {
  APIConnectionTimeoutError: new () => Error;
  APIError: new (message: string, status?: number) => Error;
};

const ExtendedMockGroq = MockGroq as MockGroqWithStatics;
ExtendedMockGroq.APIConnectionTimeoutError = class extends Error {};
ExtendedMockGroq.APIError = class extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
};

jest.unstable_mockModule('groq-sdk', () => ({ default: ExtendedMockGroq }));
import { transcribeAudioAction } from '../transcribeAudioAction';

await import('groq-sdk');

describe('transcribeAudioAction', () => {
  it('returns error when audioBlob missing', async () => {
    const fd = new FormData();
    const res = await transcribeAudioAction(fd, 'chill');
    const res = await transcribeAudioAction(fd as any, 'core');
    expect(res.success).toBe(false);
  });

  it('handles successful transcription', async () => {
    const mock = new MockGroq();
    mock.audio.transcriptions.create.mockResolvedValue({ text: 'hi', segments: [] });
    // Replace constructor used in module
    jest.mocked(ExtendedMockGroq).mockImplementation(() => mock);
    const fd = new FormData();
    fd.append('audioBlob', new File(['data'], 'audio.opus', { type: 'audio/opus' }));
    const res = await transcribeAudioAction(fd, 'chill');
    const res = await transcribeAudioAction(fd as any, 'core');
    expect(res.success).toBe(true);
    expect(res.data?.text).toBe('hi');
  });

  it('maps API error to message', async () => {
    const mock = new MockGroq();
    mock.audio.transcriptions.create.mockRejectedValue(new ExtendedMockGroq.APIError('bad', 503));
    jest.mocked(ExtendedMockGroq).mockImplementation(() => mock);
    const fd = new FormData();
    fd.append('audioBlob', new File(['data'], 'a.opus', { type: 'audio/opus' }));
    const res = await transcribeAudioAction(fd, 'chill');
    const res = await transcribeAudioAction(fd as any, 'core');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/temporarily unavailable/);
  });
});
