import { useEffect, useState } from 'react';
import { ExternalLink, Star } from 'lucide-react';
import locationService, { type Location } from '../../../services/LocationService';
import { getStoredUser } from '../../../utils/storage';

const isWebAddress = (value: string): boolean => /^https?:\/\/\S+\.\S+/i.test(value.trim());

const ReviewLinksPanel = () => {
  const user = getStoredUser();
  const role = user?.role ?? '';
  const canEditAll = role === 'company_admin';
  const canEditOwn = role === 'location_manager';
  const [locations, setLocations] = useState<Location[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, { ok: boolean; text: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        let list: Location[] = [];

        if (canEditAll) {
          list = (await locationService.getLocations()).data ?? [];
        } else if (user?.location_id) {
          const own = (await locationService.getLocation(Number(user.location_id))).data;
          list = own ? [own] : [];
        }

        if (!alive) return;
        setLocations(list);
        setDrafts(Object.fromEntries(list.map((location) => [location.id, location.review_url ?? ''])));
      } catch {
        if (alive) setLocations([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [canEditAll, user?.location_id]);

  const save = async (location: Location) => {
    const value = (drafts[location.id] ?? '').trim();

    if (value !== '' && !isWebAddress(value)) {
      setMessages((current) => ({ ...current, [location.id]: { ok: false, text: 'Enter the full link, starting with https://' } }));
      return;
    }

    setSaving(location.id);
    try {
      await locationService.updateLocation(location.id, { review_url: value === '' ? null : value });
      setLocations((current) => current.map((item) => (item.id === location.id ? { ...item, review_url: value === '' ? null : value } : item)));
      setMessages((current) => ({ ...current, [location.id]: { ok: true, text: value === '' ? 'Review link removed.' : 'Review link saved.' } }));
    } catch (error: unknown) {
      const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
      const text = response?.data?.errors?.review_url?.[0] ?? response?.data?.message ?? 'The review link could not be saved.';
      setMessages((current) => ({ ...current, [location.id]: { ok: false, text } }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Star className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">Public review links</p>
          <p className="text-xs text-gray-500">
            Each location's review page, for example its Google review link. The email shows a &ldquo;Leave a review&rdquo; button only for
            locations that have one; guests can always rate their visit with the stars. Everyone who rates is shown the link, whatever
            rating they gave.
          </p>
        </div>
      </div>

      {loading && <p className="text-xs text-gray-500">Loading locations…</p>}
      {!loading && locations.length === 0 && <p className="text-xs text-gray-500">No locations to show.</p>}

      <div className="space-y-3">
        {locations.map((location) => {
          const editable = canEditAll || (canEditOwn && Number(user?.location_id) === location.id);
          const draft = drafts[location.id] ?? '';
          const changed = draft.trim() !== (location.review_url ?? '');
          const message = messages[location.id];

          return (
            <div key={location.id} className="space-y-1">
              <label htmlFor={`review-url-${location.id}`} className="block text-xs font-medium text-gray-700">
                {location.name}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id={`review-url-${location.id}`}
                  type="url"
                  inputMode="url"
                  value={draft}
                  disabled={!editable || saving === location.id}
                  placeholder="https://g.page/r/..."
                  onChange={(event) => setDrafts((current) => ({ ...current, [location.id]: event.target.value }))}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
                {editable && (
                  <button
                    type="button"
                    onClick={() => void save(location)}
                    disabled={!changed || saving === location.id}
                    className="min-h-[38px] px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {saving === location.id ? 'Saving…' : 'Save'}
                  </button>
                )}
                {location.review_url && (
                  <a
                    href={location.review_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
                  </a>
                )}
              </div>
              {message && <p className={`text-xs ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>}
            </div>
          );
        })}
      </div>

      {!canEditAll && !canEditOwn && (
        <p className="text-xs text-gray-500">Ask a location manager or company admin to change a review link.</p>
      )}
    </div>
  );
};

export default ReviewLinksPanel;
