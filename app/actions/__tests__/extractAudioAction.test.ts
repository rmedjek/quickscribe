import { jest } from '@jest/globals';
import { extractAudioAction } from '../extractAudioAction';

// Mock fs and exec
jest.unstable_mockModule('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('audio')),
  stat: jest.fn().mockResolvedValue({ size: 123 }),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const execMock = jest.fn();
jest.unstable_mockModule('node:child_process', () => ({ exec: execMock }));

jest.unstable_mockModule('node:util', () => ({
  promisify: () => (cmd: string) => new Promise((resolve, reject) => {
    execMock(cmd, {}, (err: unknown, stdout: string, stderr: string) => {
      if (err) reject(err); else resolve({ stdout, stderr });
    });
  }),
}));

// Use the mocked modules
await import('node:fs/promises');
await import('node:child_process');
await import('node:util');

describe('extractAudioAction', () => {
  it('returns error when no file provided', async () => {
    const fd = new FormData();
    const res = await extractAudioAction(fd);
    expect(res).toEqual({ success: false, error: 'No video file received.' });
  });

  it('handles ffmpeg failure', async () => {
    execMock.mockImplementation((cmd: string, opts: any, cb: Function) => cb(new Error('boom')));
    const file = new File(['data'], 'vid.mp4', { type: 'video/mp4' });
    const fd = new FormData();
    fd.append('videoFile', file);
    const res = await extractAudioAction(fd);
    expect(res.success).toBe(false);
    expect((res as any).error).toMatch(/FFmpeg failed/);
  });

  it('returns success when ffmpeg succeeds', async () => {
    execMock.mockImplementation((cmd: string, opts: any, cb: Function) => cb(null, '', ''));
    const file = new File(['data'], 'vid.mp4', { type: 'video/mp4' });
    const fd = new FormData();
    fd.append('videoFile', file);
    const res = await extractAudioAction(fd);
    expect(res).toEqual({ success: true, audioBase64: Buffer.from('audio').toString('base64'), fileName: 'audio.opus', sizeBytes: 123 });
  });
});
