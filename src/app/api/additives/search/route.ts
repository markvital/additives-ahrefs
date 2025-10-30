import { NextResponse } from 'next/server';

import { getAdditivesForSearch } from '../../../../lib/additives';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const additives = getAdditivesForSearch();

  return NextResponse.json({ additives });
}
