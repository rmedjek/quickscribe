import { jest } from '@jest/globals';
process.env.GROQ_API_KEY = 'test';

class MockGroq {
  audio = { transcriptions: { create: jest.fn() } };
  constructor() {}
}
(MockGroq as any).APIConnectionTimeoutError = class extends Error {};
(MockGroq as any).APIError = class extends Error { constructor(message:string, public status?:number){ super(message); } };

jest.unstable_mockModule('groq-sdk', () => ({ default: MockGroq }));
import { transcribeAudioAction } from '../transcribeAudioAction';

await import('groq-sdk');

describe('transcribeAudioAction', () => {
  it('returns error when audioBlob missing', async () => {
    const fd = new FormData();
    const res = await transcribeAudioAction(fd as any, 'chill');
    expect(res.success).toBe(false);
  });

  it('handles successful transcription', async () => {
    const mock = new MockGroq();
    (mock.audio.transcriptions.create as any).mockResolvedValue({ text: 'hi', segments: [] });
    // Replace constructor used in module
    jest.mocked(MockGroq as any).mockImplementation(() => mock);
    const fd = new FormData();
    fd.append('audioBlob', new File(['data'], 'audio.opus', { type: 'audio/opus' }));
    const res = await transcribeAudioAction(fd as any, 'chill');
    expect(res.success).toBe(true);
    expect(res.data?.text).toBe('hi');
  });

  it('maps API error to message', async () => {
    const mock = new MockGroq();
    (mock.audio.transcriptions.create as any).mockRejectedValue(new (MockGroq as any).APIError('bad', 503));
    jest.mocked(MockGroq as any).mockImplementation(() => mock);
    const fd = new FormData();
    fd.append('audioBlob', new File(['data'], 'a.opus', { type: 'audio/opus' }));
    const res = await transcribeAudioAction(fd as any, 'chill');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/temporarily unavailable/);
  });
});
