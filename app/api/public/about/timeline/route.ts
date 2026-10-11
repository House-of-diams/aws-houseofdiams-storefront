import { NextResponse } from 'next/server';
import { loadAboutTimelineFromRds } from '@/lib/repositories/about-repository';

export const dynamic = 'force-static';
export const revalidate = 300;

async function readPublicContent() {

  const { data, error } = { data: await loadAboutTimelineFromRds(), error: null as { code?: string; message: string } | null };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function GET() {
  try { return await readPublicContent() }
  catch {
    return NextResponse.json({ error: 'Unable to load content.' }, { status: 500 })
  }
}
