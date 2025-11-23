import { getFormattedLastUpdated } from '../lib/last-updated';

export function LastUpdated() {
  const formatted = getFormattedLastUpdated();

  if (!formatted) {
    return null;
  }

  return (
    <div className="content-shell last-updated">
      <span>Last updated:</span> <strong>{formatted}</strong>
    </div>
  );
}
