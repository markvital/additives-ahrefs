export const formatAdditiveDisplayName = (eNumber: string, title: string): string => {
  const parts = [eNumber, title]
    .map((part) => part.trim())
    .filter((part, index, list) => part.length > 0 && list.indexOf(part) === index);

  return parts.join(' - ') || 'Additive';
};

export const formatOriginLabel = (value: string): string => {
  if (!value) {
    return '';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};
