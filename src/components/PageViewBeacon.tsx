import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { trackPageView, type AnalyticsEntityType } from '../utils/analytics';
import { ensureVisitorIdentified } from '../utils/guestIdentity';
import { extractIdFromSlug } from '../utils/slug';

interface PageViewBeaconProps {
  pageType: string;
  entityType?: AnalyticsEntityType;
  entityIdParam?: string;
  entityIdFromSlugParam?: string;
  locationSlugParam?: string;
}

const PageViewBeacon: React.FC<PageViewBeaconProps> = ({
  pageType,
  entityType,
  entityIdParam,
  entityIdFromSlugParam,
  locationSlugParam,
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

  const locationSlug = locationSlugParam ? params[locationSlugParam] : undefined;

  React.useEffect(() => {
    void trackPageView({
      page_type: pageType,
      entity_type: entityType,
      entity_id: entityId,
      location_slug: locationSlug,
    });
    ensureVisitorIdentified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, entityType, entityId, pageType, locationSlug]);

  return null;
};

export default PageViewBeacon;
