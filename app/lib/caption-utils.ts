export interface Segment {
    id: number;
    start: number;
    end: number;
    text: string;
  }
  
  export function formatTimestamp(seconds: number, format: 'srt' | 'vtt'): string {
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    const secs = Math.floor(seconds);
    const milliseconds = Math.floor((seconds - secs) * 1000);
    const separator = format === 'srt' ? ',' : '.';
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`;
  }
  
  export function generateSRT(segments: Segment[]): string {
    return segments.map((segment, index) => {
      const segmentNumber = index + 1;
      const startTime = formatTimestamp(segment.start, 'srt');
      const endTime = formatTimestamp(segment.end, 'srt');
      const text = segment.text.trim();
      return `${segmentNumber}\n${startTime} --> ${endTime}\n${text}\n`;
    }).join('\n');
  }
  
  export function generateVTT(segments: Segment[]): string {
    const body = segments.map((segment) => {
      const startTime = formatTimestamp(segment.start, 'vtt');
      const endTime = formatTimestamp(segment.end, 'vtt');
      const text = segment.text.trim();
      return `${startTime} --> ${endTime}\n${text}\n`;
    }).join('\n');
    return `WEBVTT\n\n${body}`;
  }