import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { trackPageView, type AnalyticsEntityType } from '../utils/analytics';
import { extractIdFromSlug } from '../utils/slug';

interface PageViewBeaconProps {
  /** Catalog `page_type` — see analytics integration guide §3. */
  pageType: string;
  /** Optional entity attached to the page (offer pages MUST set this). */
  entityType?: AnalyticsEntityType;
  /** Route param holding the numeric id (e.g. `eventId`). */
  entityIdParam?: string;
  /** Route param holding a slug like `laser-tag-123`. */
  entityIdFromSlugParam?: string;
}

/**
 * Drop-in component that fires one `page_view` per route change. Render
 * inside customer-facing routes only — admin routes are deliberately not
 * tracked (see integration guide §2).
 */
const PageViewBeacon: React.FC<PageViewBeaconProps> = ({
  pageType,
  entityType,
  entityIdParam,
  entityIdFromSlugParam,
}) => {
  const loc = useLocation();
  const params = useParams<Record<string, string>>();

  let entityId: number | undefined;
  if (entityIdParam && params[entityIdParam]) {
    const n = Number(params[entityIdParam]);
    if (Number.isFinite(n) && n > 0) entityId = n;
  } else if (entityIdFromSlugParam && params[entityIdFromSlugParam]) {
    const n = extractIdFromSlug(params[entityIdFromSlugParam]!);
    if (Number.isFinite(n) && n > 0) entityId = n;
  }

  React.useEffect(() => {
    void trackPageView({
      page_type: pageType,
      entity_type: entityType,
      entity_id: entityId,
    });
    // Fire whenever the path or the resolved entity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, entityType, entityId, pageType]);

  return null;
};

export default PageViewBeacon;
