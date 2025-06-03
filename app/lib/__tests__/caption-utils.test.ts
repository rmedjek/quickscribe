import { describe, it } from 'node:test';
import assert from 'node:assert/strict'; // Use Node's assert for expectations
import { formatTimestamp, generateSRT, generateVTT, Segment } from '../caption-utils';

describe('formatTimestamp', () => {
  it('formats SRT timestamps correctly', () => {
    assert.strictEqual(formatTimestamp(75.5, 'srt'), '00:01:15,500');
    assert.strictEqual(formatTimestamp(3661.789, 'srt'), '01:01:01,789');
  });

  it('formats VTT timestamps correctly', () => {
    assert.strictEqual(formatTimestamp(75.5, 'vtt'), '00:01:15.500');
    assert.strictEqual(formatTimestamp(3661.789, 'vtt'), '01:01:01.789');
  });
});

describe('caption generators', () => {
  const segments: Segment[] = [
    { id: 0, start: 0, end: 1, text: 'Hello' },
    { id: 1, start: 1, end: 2, text: 'World' }
  ];

  it('generates SRT correctly', () => {
    const expected =
`1
00:00:00,000 --> 00:00:01,000
Hello

2
00:00:01,000 --> 00:00:02,000
World
`;
    assert.strictEqual(generateSRT(segments), expected);
  });

  it('generates VTT correctly', () => {
    const expected =
`WEBVTT

00:00:00.000 --> 00:00:01.000
Hello

00:00:01.000 --> 00:00:02.000
World
`;
    assert.strictEqual(generateVTT(segments), expected);
  });
});
