import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import visitFollowUpService from '../../../services/VisitFollowUpService';
import Pagination from '../../ui/Pagination';
import { RatingStars } from './VisitFollowUpCard';
import { formatFollowUpTime } from '../../../utils/visitFollowUpNotice';
import { useOptionalLocationScope } from '../../../contexts/LocationContext';
import type { GuestRatingsResponse } from '../../../types/visitFollowUp.types';

const GuestRatingsPanel = () => {
  const locationId = useOptionalLocationScope()?.effectiveLocationId ?? null;
  const [data, setData] = useState<GuestRatingsResponse | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [scope, setScope] = useState(locationId);

  if (scope !== locationId) {
    setScope(locationId);
    setPage(1);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await visitFollowUpService.getRatings({
        page,
        per_page: 10,
        ...(lowOnly ? { max_rating: 2 } : {}),
        ...(locationId ? { location_id: locationId } : {}),
      }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [page, lowOnly, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const rated = summary?.rated ?? 0;
  const responseRate = summary && summary.requested > 0 ? Math.round((summary.rated / summary.requested) * 100) : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Guest ratings
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => {
              setLowOnly(event.target.checked);
              setPage(1);
            }}
            className="w-4 h-4 rounded border-gray-300"
          />
          Only 1–2 stars
        </label>
      </div>

      {failed && <p className="text-sm text-red-600">Ratings could not be loaded.</p>}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-800">Average</p>
            <p className="text-2xl font-semibold text-amber-900">{summary.average !== null ? summary.average.toFixed(1) : '–'}</p>
            {summary.average !== null && <RatingStars rating={Math.round(summary.average)} />}
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">Ratings</p>
            <p className="text-2xl font-semibold text-gray-900">{rated}</p>
            <p className="text-xs text-gray-500">
              {summary.requested} requested{responseRate !== null ? ` · ${responseRate}% answered` : ''}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg space-y-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.distribution[String(stars)] ?? 0;
              const width = rated > 0 ? Math.round((count / rated) * 100) : 0;

              return (
                <div key={stars} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-3 text-right">{stars}</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded">
                    <div className="h-1.5 bg-amber-400 rounded" style={{ width: `${width}%` }} />
                  </div>
                  <span className="w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && !data && <p className="text-sm text-gray-500">Loading ratings…</p>}
      {data && data.ratings.length === 0 && (
        <p className="text-sm text-gray-500">{lowOnly ? 'No low ratings yet.' : 'No guest has rated a visit yet.'}</p>
      )}

      {data && data.ratings.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {data.ratings.map((row) => (
            <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {row.rating !== null && <RatingStars rating={row.rating} />}
                  <span className="text-sm text-gray-900">{row.recipient_name || row.recipient_email_masked}</span>
                  {row.location_name && <span className="text-xs text-gray-500">{row.location_name}</span>}
                </div>
                {row.comment && <p className="text-sm text-gray-700 mt-1 break-words">&ldquo;{row.comment}&rdquo;</p>}
                <p className="text-xs text-gray-500 mt-0.5">Rated {formatFollowUpTime(row.rated_at)}</p>
              </div>
              <Link to={row.visit_path} className="shrink-0 text-xs font-semibold text-gray-700 underline">
                Open visit
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && data.pagination.last_page > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={data.pagination.current_page}
            totalPages={data.pagination.last_page}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default GuestRatingsPanel;
