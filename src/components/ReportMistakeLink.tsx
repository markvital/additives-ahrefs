'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useReportMistake } from './ReportMistakeContext';

const FORM_BASE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeFSUfobYm1_lqyOayUH2qjbecuPb0oelgJn_rxQvb7sL8AsA/viewform?usp=pp_url';
const NAME_PARAM = 'entry.398194313';
const URL_PARAM = 'entry.2052369818';

interface ReportMistakeLinkProps {
  className?: string;
}

export function ReportMistakeLink({ className }: ReportMistakeLinkProps) {
  const { name } = useReportMistake();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [href, setHref] = useState(FORM_BASE_URL);

  const searchKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const origin = window.location.origin || '';
    const path = pathname ?? window.location.pathname;
    const query = searchKey ? `?${searchKey}` : '';
    const currentUrl = origin ? `${origin}${path}${query}` : window.location.href;

    const params = new URLSearchParams();

    if (currentUrl && currentUrl.trim().length > 0) {
      params.set(URL_PARAM, currentUrl.trim());
    }

    if (name && name.trim().length > 0) {
      params.set(NAME_PARAM, name.trim());
    }

    const queryString = params.toString();
    setHref(queryString ? `${FORM_BASE_URL}&${queryString}` : FORM_BASE_URL);
  }, [pathname, searchKey, name]);

  return (
    <Link href={href} className={className} target="_blank" rel="noopener noreferrer">
      Report mistake
    </Link>
  );
}
