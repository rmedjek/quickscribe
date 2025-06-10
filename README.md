# QuickScribe

QuickScribe is a Next.js application for generating transcripts from audio or video files. Upload a file or provide a link and the app will extract the audio, send it to Groq's transcription API and let you download the results or run extra AI actions such as summarisation.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create a `.env.local` file** with the following variables:
   ```env
   GROQ_API_KEY=your_groq_api_key
   SERVER_ACTION_BODY_LIMIT_CONFIG=50mb
   NEXT_PUBLIC_MAX_UPLOAD_SIZE_DISPLAY=50 MB
   ```
   - `GROQ_API_KEY` – sign up at [groq.com](https://console.groq.com) to obtain an API key.
   - `SERVER_ACTION_BODY_LIMIT_CONFIG` – maximum payload size accepted by Next.js Server Actions. The default is `50mb`.
   - `NEXT_PUBLIC_MAX_UPLOAD_SIZE_DISPLAY` – shown in the UI so users know the upload limit. Match it to the server action limit.

3. **Run the development server**
   ```bash
   npm run dev
   ```
   Visit <http://localhost:3000>.

## Testing

Execute the test suite with:
```bash
npm test
```

## Deployment

Run `npm run build` for a production build or `npm run vercel-build` when deploying to Vercel. The latter installs `ffmpeg` and `yt-dlp` before running the Next.js build. Ensure the same environment variables are configured in your hosting platform.
Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## FFmpeg Listener Cleanup
To avoid memory leaks when performing multiple conversions, progress listeners are now detached after each FFmpeg `exec` when the library supports an `off()` method. When `off()` is unavailable, the implementation tracks whether a listener was already attached to prevent duplicates.
