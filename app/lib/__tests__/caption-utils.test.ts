import { formatTimestamp, generateSRT, generateVTT, Segment } from '../caption-utils';

describe('formatTimestamp', () => {
  it('formats SRT timestamps correctly', () => {
    expect(formatTimestamp(75.5, 'srt')).toBe('00:01:15,500');
    expect(formatTimestamp(3661.789, 'srt')).toBe('01:01:01,789');
  });

  it('formats VTT timestamps correctly', () => {
    expect(formatTimestamp(75.5, 'vtt')).toBe('00:01:15.500');
    expect(formatTimestamp(3661.789, 'vtt')).toBe('01:01:01.789');
  });
});

describe('caption generators', () => {
  const segments: Segment[] = [
    { id: 0, start: 0, end: 1, text: 'Hello' },
    { id: 1, start: 1, end: 2, text: 'World' }
  ];

  it('generates SRT correctly', () => {
    const expected =
`1\n00:00:00,000 --> 00:00:01,000\nHello\n\n2\n00:00:01,000 --> 00:00:02,000\nWorld\n`;
    expect(generateSRT(segments)).toBe(expected);
  });

  it('generates VTT correctly', () => {
    const expected =
`WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n\n00:00:01.000 --> 00:00:02.000\nWorld\n`;
    expect(generateVTT(segments)).toBe(expected);
  });
});
