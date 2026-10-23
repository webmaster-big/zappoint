import { useCallback, useEffect, useRef, useState } from 'react';
import { Link2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import photoService from '../../../services/PhotoService';
import type { PhotoMessageLink, PhotoMessageLinksResponse } from '../../../types/photo.types';

interface MessageLinksPanelProps {
  fieldCls: string;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
  onLinksChanged: (links: PhotoMessageLink[]) => void;
}

type LinkDraft = { label: string; default_url: string; urls: Record<number, string> };

const errorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const looksLikeDomain = /^[^\s/?#@:]+\.[^\s/?#@:]+(?:[:/?#]|$)/;

const normaliseUrl = (value: string): string => {
  const trimmed = value.trim();
  const bare = trimmed.replace(/^\/+/, '');
  return looksLikeDomain.test(bare) ? `https://${bare}` : trimmed;
};

const savedUrl = (link: PhotoMessageLink, locationId: number): string =>
  link.urls.find((row) => row.location_id === locationId)?.url ?? '';

const draftFor = (link: PhotoMessageLink): LinkDraft => ({
  label: link.label,
  default_url: link.default_url ?? '',
  urls: Object.fromEntries(link.urls.map((row) => [row.location_id, row.url])),
});

const MessageLinksPanel = ({ fieldCls, onNotify, onLinksChanged }: MessageLinksPanelProps) => {
  const [data, setData] = useState<PhotoMessageLinksResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const edited = useRef(new Set<string>());
  const [drafts, setDrafts] = useState<Record<number, LinkDraft>>({});
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const forget = (linkId: number) => {
    edited.current.forEach((key) => {
      if (key.startsWith(`${linkId}:`)) edited.current.delete(key);
    });
  };

  const apply = useCallback(
    (next: PhotoMessageLinksResponse) => {
      setData(next);
      setDrafts((prev) =>
        Object.fromEntries(
          next.links.map((link) => {
            const fresh = draftFor(link);
            const previous = prev[link.id];
            if (!previous) return [link.id, fresh];
            const kept = (field: string) => edited.current.has(`${link.id}:${field}`);
            const urls = { ...fresh.urls };
            Object.entries(previous.urls).forEach(([locationId, value]) => {
              if (kept(`url:${locationId}`)) urls[Number(locationId)] = value;
            });
            return [
              link.id,
              {
                label: kept('label') ? previous.label : fresh.label,
                default_url: kept('default') ? previous.default_url : fresh.default_url,
                urls,
              },
            ];
          }),
        ),
      );
      onLinksChanged(next.links);
    },
    [onLinksChanged],
  );

  const load = useCallback(async () => {
    try {
      const result = await photoService.getMessageLinks();
      if (!result) {
        setUnavailable(true);
        return;
      }
      setLoadFailed(null);
      apply(result);
    } catch (e) {
      setLoadFailed(errorMessage(e, 'The links could not be loaded.'));
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const editField = (link: PhotoMessageLink, field: string, saved: string, value: string, update: (draft: LinkDraft) => LinkDraft) => {
    const key = `${link.id}:${field}`;
    if (value === saved) edited.current.delete(key);
    else edited.current.add(key);
    setDrafts((prev) => ({ ...prev, [link.id]: update(prev[link.id] ?? draftFor(link)) }));
  };

  const save = async (link: PhotoMessageLink) => {
    if (!data) return;
    const draft = drafts[link.id];
    if (!draft) return;
    setBusyId(link.id);
    const failures: string[] = [];
    let sent = 0;
    try {
      const label = draft.label.trim();
      const defaultUrl = normaliseUrl(draft.default_url);
      if (data.can_manage_links && (label !== link.label || defaultUrl !== (link.default_url ?? ''))) {
        sent += 1;
        try {
          await photoService.updateMessageLink(link.id, { label, default_url: defaultUrl || null });
          edited.current.delete(`${link.id}:label`);
          edited.current.delete(`${link.id}:default`);
        } catch (e) {
          failures.push(`Name or default address: ${errorMessage(e, 'not saved')}`);
        }
      }
      for (const location of data.locations) {
        const after = normaliseUrl(draft.urls[location.id] ?? '');
        if (after !== savedUrl(link, location.id)) {
          sent += 1;
          try {
            await photoService.setMessageLinkUrl(link.id, location.id, after || null);
            edited.current.delete(`${link.id}:url:${location.id}`);
          } catch (e) {
            failures.push(`${location.name}: ${errorMessage(e, 'not saved')}`);
          }
        }
      }
      if (sent === 0) {
        forget(link.id);
        onNotify('Nothing has changed on this link.', 'info');
        return;
      }
      if (failures.length > 0) {
        onNotify(`Some changes were not saved. ${failures.join(' ')}`, 'error');
      } else {
        onNotify(`Saved the ${label || link.label} link.`, 'success');
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    if (!newLabel.trim()) return;
    setBusyId('new');
    try {
      await photoService.createMessageLink({ label: newLabel.trim(), default_url: normaliseUrl(newUrl) || null });
      setNewLabel('');
      setNewUrl('');
      onNotify('Link added. Give each location its own address in the link above if it differs from the default.', 'success');
      await load();
    } catch (e) {
      onNotify(errorMessage(e, 'That link could not be added.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (link: PhotoMessageLink) => {
    if (!window.confirm(`Remove the ${link.label} link? Messages that use {{${link.variable}}} will show nothing in its place.`)) return;
    setBusyId(link.id);
    try {
      await photoService.deleteMessageLink(link.id);
      forget(link.id);
      onNotify('Link removed.', 'info');
      await load();
    } catch (e) {
      onNotify(errorMessage(e, 'That link could not be removed.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (unavailable) return null;

  const retry = (
    <StandardButton size="sm" variant="secondary" icon={RefreshCcw} onClick={() => void load()}>
      Try again
    </StandardButton>
  );

  return (
    <section id="message-links" className="bg-white border border-gray-200 rounded-2xl p-5">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-gray-500" aria-hidden="true" />
        Links for photo messages
      </h2>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        Add social media and other links once, then give each location its own address. A location without its own address uses the
        default. In the photo messages above, <code className="text-xs bg-gray-100 rounded px-1">{'{{links}}'}</code> lists the
        location&apos;s links and a link&apos;s own name (for example{' '}
        <code className="text-xs bg-gray-100 rounded px-1 break-all">{'{{link_instagram}}'}</code>) gives just its address. Emails list
        every link; text messages list as many as fit in about 480 characters, so in texts use one or two link names instead. Escape-room
        photos use the Thanks for Playing email, so these links don&apos;t appear there.
      </p>

      {data === null ? (
        loadFailed ? (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-700">{loadFailed}</p>
            {retry}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading links…</p>
        )
      ) : (
        <div className="space-y-3">
          {loadFailed && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{loadFailed} The list below may be out of date.</p>
              {retry}
            </div>
          )}

          {data.links.length === 0 && <p className="text-sm text-gray-500">No links yet.</p>}

          {data.links.map((link) => {
            const draft = drafts[link.id] ?? draftFor(link);
            const saving = busyId === link.id;

            return (
              <div key={link.id} className="rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700 break-all">{`{{${link.variable}}}`}</code>
                  {data.can_manage_links && (
                    <button
                      type="button"
                      onClick={() => void remove(link)}
                      disabled={busyId !== null}
                      className="inline-flex items-center gap-1 text-xs text-red-700 rounded-lg px-2 py-1 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm text-gray-700">
                    Name shown in messages
                    <input
                      value={draft.label}
                      onChange={(e) => {
                        const value = e.target.value;
                        editField(link, 'label', link.label, value, (current) => ({ ...current, label: value }));
                      }}
                      disabled={!data.can_manage_links || saving}
                      maxLength={80}
                      aria-label={`Name shown in messages for the ${link.label} link`}
                      className={`${fieldCls} mt-1 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed`}
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Default address
                    <input
                      type="url"
                      inputMode="url"
                      value={draft.default_url}
                      onChange={(e) => {
                        const value = e.target.value;
                        editField(link, 'default', link.default_url ?? '', value, (current) => ({ ...current, default_url: value }));
                      }}
                      disabled={!data.can_manage_links || saving}
                      placeholder="https://"
                      aria-label={`Default address for ${link.label}`}
                      className={`${fieldCls} mt-1 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed`}
                    />
                  </label>
                </div>

                {data.locations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address for each location</p>
                    {data.locations.map((location) => (
                      <label key={location.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-center gap-1 sm:gap-3 text-sm text-gray-700">
                        <span className="truncate">{location.name}</span>
                        <input
                          type="url"
                          inputMode="url"
                          value={draft.urls[location.id] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            editField(link, `url:${location.id}`, savedUrl(link, location.id), value, (current) => ({
                              ...current,
                              urls: { ...current.urls, [location.id]: value },
                            }));
                          }}
                          disabled={saving}
                          placeholder={draft.default_url ? `Uses the default: ${draft.default_url}` : 'https://'}
                          aria-label={`${link.label} address for ${location.name}`}
                          className={`${fieldCls} disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed`}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <StandardButton size="sm" icon={Save} onClick={() => void save(link)} loading={saving} disabled={busyId !== null}>
                  Save link
                </StandardButton>
              </div>
            );
          })}

          {data.can_manage_links && data.links.length < data.max_links && (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">Add a link</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm text-gray-700">
                  Name, for example Instagram
                  <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={80} className={`${fieldCls} mt-1`} />
                </label>
                <label className="block text-sm text-gray-700">
                  Default address (optional)
                  <input
                    type="url"
                    inputMode="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://"
                    className={`${fieldCls} mt-1`}
                  />
                </label>
              </div>
              <StandardButton size="sm" icon={Plus} onClick={() => void add()} loading={busyId === 'new'} disabled={busyId !== null || !newLabel.trim()}>
                Add link
              </StandardButton>
            </div>
          )}

          {!data.can_manage_links && (
            <p className="text-xs text-gray-500">Only company admins can add or rename links. You can set your location&apos;s addresses.</p>
          )}
        </div>
      )}
    </section>
  );
};

export default MessageLinksPanel;
