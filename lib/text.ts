export const formatFilterLabel = (value: string): string => {
  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  const formatSegment = (segment: string): string => {
    if (!segment) {
      return '';
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return normalized
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((segment) => formatSegment(segment))
        .join('-'),
    )
    .join(' ');
};
