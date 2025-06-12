import { jest } from '@jest/globals';
import { processVideoLinkAction } from '../processVideoLinkAction';

// Mock dependencies
jest.unstable_mockModule('node-fetch-commonjs', () => ({ default: jest.fn() }));
const execMock = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({ exec: execMock }));
jest.unstable_mockModule('node:fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({ size: 100 }),
  readFile: jest.fn().mockResolvedValue(Buffer.from('audio')),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.unstable_mockModule('node:fs', () => ({ createWriteStream: jest.fn(() => ({ on: jest.fn(), })), }));
jest.unstable_mockModule('../transcribeAudioAction', () => ({
  transcribeAudioAction: jest.fn(async () => ({ success: false, error: 'Groq fail' })),
}));

await import('node-fetch-commonjs');
await import('node:child_process');
await import('node:fs/promises');
await import('node:fs');
await import('../transcribeAudioAction');

describe('processVideoLinkAction', () => {
  it('rejects playlist URLs', async () => {
    const res = await processVideoLinkAction('https://youtube.com/watch?v=a&list=b', 'chill');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/playlist/);
  });

  it('propagates transcription failure', async () => {
    execMock.mockImplementation(
      (
        cmd: string,
        opts: Record<string, unknown>,
        cb: (err: Error | null, out: string, errOut: string) => void,
      ) => cb(null, '', '')
    );
    const res = await processVideoLinkAction('https://example.com/video.mp4', 'chill');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Groq fail/);
  });
});
