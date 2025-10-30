import { NextResponse } from 'next/server';

import { getAdditiveBySlug } from '../../../../lib/additives';
import { getSearchHistory } from '../../../../lib/search-history';

export const runtime = 'nodejs';
export const revalidate = 3600;

export async function GET(_request: Request, context: any) {
  const slug: string | undefined = context?.params?.slug;

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  const additive = getAdditiveBySlug(slug);

  if (!additive) {
    return NextResponse.json({ error: 'Additive not found' }, { status: 404 });
  }

  const searchHistory = getSearchHistory(slug);

  return NextResponse.json({
    additive: {
      ...additive,
      searchHistory,
    },
  });
}
