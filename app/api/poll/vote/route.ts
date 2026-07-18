import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: 'Voting now happens in the browser wallet on the survey page.' },
    { status: 410 },
  );
}
