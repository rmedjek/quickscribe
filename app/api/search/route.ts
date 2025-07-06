// app/api/search/route.ts

import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {searchParams} = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return NextResponse.json([], {status: 200}); // Return empty array if no query
    }

    // Format the query for PostgreSQL's plainto_tsquery function.
    // This handles spaces and basic stop words, creating a query like 'word1 & word2'
    const searchQuery = q.trim().split(/\s+/).join(" & ");

    // Use Prisma's raw query template to safely execute the full-text search.
    // ts_headline generates snippets with highlighted search terms.
    const results = await prisma.$queryRaw`
      SELECT
        id,
        COALESCE("displayTitle", "sourceFileName") as "displayTitle",
        "createdAt",
        ts_headline('english', "transcriptText", plainto_tsquery('english', ${searchQuery}), 'StartSel=<b>, StopSel=</b>, MaxFragments=2, MinWords=5, MaxWords=15, FragmentDelimiter=" ... "') as snippet
      FROM "transcription_jobs"
      WHERE
        "userId" = ${session.user.id} AND
        transcript_tsvector @@ plainto_tsquery('english', ${searchQuery})
      ORDER BY
        ts_rank(transcript_tsvector, plainto_tsquery('english', ${searchQuery})) DESC
      LIMIT 15;
    `;

    return NextResponse.json(results);
  } catch (error) {
    console.error("[API_SEARCH_ERROR]", error);
    return NextResponse.json(
      {error: "An error occurred while searching."},
      {status: 500}
    );
  }
}
