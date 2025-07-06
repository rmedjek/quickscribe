// app/api/search/route.ts

import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";

// Configuration for Search
const SEARCH_LIMITS = {
  default: 25,
  min: 10,
  max: 100,
};
const MIN_QUERY_LENGTH = 3;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {searchParams} = new URL(req.url);
    const rawQuery = searchParams.get("q");

    // Input validation
    const cleanQuery = rawQuery?.trim();
    if (!cleanQuery || cleanQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        {
          results: [],
          pagination: {
            total: 0,
            page: 1,
            limit: SEARCH_LIMITS.default,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
        {status: 200}
      );
    }

    // Pagination logic
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(
      searchParams.get("limit") || `${SEARCH_LIMITS.default}`,
      10
    );
    const safeLimit = Math.min(
      Math.max(limit, SEARCH_LIMITS.min),
      SEARCH_LIMITS.max
    );
    const offset = (page - 1) * safeLimit;

    const searchQuery = cleanQuery;
    const queryConfig = "english"; // The language for parsing the user's search text

    // --- THIS IS THE FIX: The query syntax is now corrected and simplified ---
    const countResult: [{count: bigint}] = await prisma.$queryRaw`
      WITH q AS (SELECT websearch_to_tsquery(${queryConfig}::regconfig, ${searchQuery}) AS query)
      SELECT COUNT(*)
      FROM "transcription_jobs", q
      WHERE
        "userId" = ${session.user.id} AND
        transcript_tsvector @@ q.query
    `;
    const total = Number(countResult[0].count);
    const totalPages = Math.ceil(total / safeLimit);

    const results = await prisma.$queryRaw`
      WITH q AS (SELECT websearch_to_tsquery(${queryConfig}::regconfig, ${searchQuery}) AS query)
      SELECT
        id,
        COALESCE("displayTitle", "sourceFileName") as "displayTitle",
        "createdAt",
        language,
        ts_headline(
          CASE 
            WHEN language = 'ar' THEN 'arabic' WHEN language = 'da' THEN 'danish'
            WHEN language = 'nl' THEN 'dutch'  WHEN language = 'en' THEN 'english'
            WHEN language = 'fi' THEN 'finnish' WHEN language = 'fr' THEN 'french'
            WHEN language = 'de' THEN 'german' WHEN language = 'hu' THEN 'hungarian'
            WHEN language = 'it' THEN 'italian' WHEN language = 'no' THEN 'norwegian'
            WHEN language = 'pt' THEN 'portuguese' WHEN language = 'ro' THEN 'romanian'
            WHEN language = 'ru' THEN 'russian' WHEN language = 'es' THEN 'spanish'
            WHEN language = 'sv' THEN 'swedish' WHEN language = 'tr' THEN 'turkish'
            ELSE 'simple'
          END::regconfig,
          "transcriptText", 
          q.query,
          'StartSel=<b>, StopSel=</b>, MaxFragments=2, MinWords=5, MaxWords=15, FragmentDelimiter=" ... "'
        ) as snippet
      FROM "transcription_jobs", q
      WHERE
        "userId" = ${session.user.id} AND
        transcript_tsvector @@ q.query
      ORDER BY
        ts_rank_cd(transcript_tsvector, q.query) DESC
      LIMIT ${safeLimit}
      OFFSET ${offset}
    `;

    return NextResponse.json({
      results,
      pagination: {
        total,
        page,
        limit: safeLimit,
        totalPages,
        hasNext: offset + safeLimit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("[API_SEARCH_ERROR]", error);
    return NextResponse.json(
      {error: "An error occurred while searching."},
      {status: 500}
    );
  }
}
