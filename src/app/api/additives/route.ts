import { NextResponse } from 'next/server';

import {
  type AdditiveSortMode,
  parseAdditiveSortMode,
  parseShowClassesParam,
} from '../../../lib/additives';
import { loadAdditivesBatch } from '../../actions/additives';

export const revalidate = 604800; // 7 days

const toSafeOffset = (value: string | null): number => {
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const API_LIMIT = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortMode: AdditiveSortMode = parseAdditiveSortMode(searchParams.get('sort'));
  const showClasses = parseShowClassesParam(searchParams.get('classes'));
  const offset = toSafeOffset(searchParams.get('offset'));
  const filterType = searchParams.get('filterType');
  const filterSlug = searchParams.get('filterSlug');
  const filterTypeValue = filterType === 'function' || filterType === 'origin' ? filterType : null;
  const filter = filterTypeValue && filterSlug ? ({ type: filterTypeValue, slug: filterSlug } as const) : null;

  try {
    const result = await loadAdditivesBatch({
      offset,
      limit: API_LIMIT,
      sortMode,
      showClasses,
      filter,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 's-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Failed to fetch additives batch', error);
    return NextResponse.json(
      { error: 'Failed to load additives' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
