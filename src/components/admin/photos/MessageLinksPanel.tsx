import { useCallback, useEffect, useState } from 'react';
import { Link2, Plus, Save, Trash2 } from 'lucide-react';
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

const draftFor = (link: PhotoMessageLink): LinkDraft => ({
  label: link.label,
  default_url: link.default_url ?? '',
  urls: Object.fromEntries(link.urls.map((row) => [row.location_id, row.url])),
});

const MessageLinksPanel = ({ fieldCls, onNotify, onLinksChanged }: MessageLinksPanelProps) => {
  const [data, setData] = useState<PhotoMessageLinksResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, LinkDraft>>({});
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const apply = useCallback(
    (next: PhotoMessageLinksResponse) => {
      setData(next);
      setDrafts(Object.fromEntries(next.links.map((link) => [link.id, draftFor(link)])));
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
      apply(result);
    } catch (e) {
      onNotify(errorMessage(e, 'The links could not be loaded.'), 'error');
    }
  }, [apply, onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (link: PhotoMessageLink) => {
    if (!data) return;
    const draft = drafts[link.id];
    if (!draft) return;
    setBusyId(link.id);
    try {
      if (data.can_manage_links && (draft.label.trim() !== link.label || draft.default_url.trim() !== (link.default_url ?? ''))) {
        await photoService.updateMessageLink(link.id, { label: draft.label.trim(), default_url: draft.default_url.trim() || null });
      }
      for (const location of data.locations) {
        const before = link.urls.find((row) => row.location_id === location.id)?.url ?? '';
        const after = (draft.urls[location.id] ?? '').trim();
        if (after !== before) {
          await photoService.setMessageLinkUrl(link.id, location.id, after || null);
        }
      }
      onNotify(`Saved the ${draft.label.trim() || link.label} link.`, 'success');
      await load();
    } catch (e) {
      onNotify(errorMessage(e, 'That link could not be saved.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    if (!newLabel.trim()) return;
    setBusyId('new');
    try {
      await photoService.createMessageLink({ label: newLabel.trim(), default_url: newUrl.trim() || null });
      setNewLabel('');
      setNewUrl('');
      onNotify('Link added. Set each location\'s own address below if it differs.', 'success');
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
      onNotify('Link removed.', 'info');
      await load();
    } catch (e) {
      onNotify(errorMessage(e, 'That link could not be removed.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (unavailable) return null;

  return (
    <section id="message-links" className="bg-white border border-gray-200 rounded-2xl p-5">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-gray-500" aria-hidden="true" />
        Links for photo messages
      </h2>
      <p className="text-sm text-gray-600 mt-1 mb-4">
        Add social media and other links once, then give each location its own address. In any photo message,{' '}
        <code className="text-xs bg-gray-100 rounded px-1">{'{{links}}'}</code> lists every link the location has, and a link&apos;s own
        name (for example <code className="text-xs bg-gray-100 rounded px-1">{'{{link_instagram}}'}</code>) gives just its address.
        A location without its own address uses the default.
      </p>

      {data === null ? (
        <p className="text-sm text-gray-500">Loading links…</p>
      ) : (
        <div className="space-y-3">
          {data.links.length === 0 && <p className="text-sm text-gray-500">No links yet.</p>}

          {data.links.map((link) => {
            const draft = drafts[link.id] ?? draftFor(link);
            const setDraft = (next: Partial<LinkDraft>) => setDrafts((prev) => ({ ...prev, [link.id]: { ...draft, ...next } }));

            return (
              <div key={link.id} className="rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{`{{${link.variable}}}`}</code>
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
                      onChange={(e) => setDraft({ label: e.target.value })}
                      disabled={!data.can_manage_links}
                      maxLength={80}
                      className={`${fieldCls} mt-1 disabled:bg-gray-50`}
                    />
                  </label>
                  <label className="block text-sm text-gray-700">
                    Default address
                    <input
                      type="url"
                      inputMode="url"
                      value={draft.default_url}
                      onChange={(e) => setDraft({ default_url: e.target.value })}
                      disabled={!data.can_manage_links}
                      placeholder="https://"
                      className={`${fieldCls} mt-1 disabled:bg-gray-50`}
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
                          onChange={(e) => setDraft({ urls: { ...draft.urls, [location.id]: e.target.value } })}
                          placeholder={draft.default_url ? `Uses the default: ${draft.default_url}` : 'https://'}
                          className={fieldCls}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <StandardButton size="sm" icon={Save} onClick={() => void save(link)} loading={busyId === link.id} disabled={busyId !== null}>
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
