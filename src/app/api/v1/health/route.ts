import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      data: {
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database connectivity check failed.",
        },
      },
      { status: 503 },
    );
  }
}

