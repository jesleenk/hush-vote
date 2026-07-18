import { NextResponse } from 'next/server';
import { readPollSnapshot } from '@/lib/midnight-server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshot = await readPollSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read survey state' },
      { status: 503 },
    );
  }
}
