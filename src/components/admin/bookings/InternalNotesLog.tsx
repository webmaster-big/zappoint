import { useCallback, useEffect, useState } from 'react';
import { History, Lock, Pencil, Plus, StickyNote } from 'lucide-react';
import bookingService, { type InternalNote } from '../../../services/bookingService';
import { bookingCacheService } from '../../../services/BookingCacheService';

interface InternalNotesLogProps {
  bookingId: number;
  /** Tighter spacing for the detail modals, which are already dense. */
  compact?: boolean;
  /**
   * The booking's digest text, so the badge and the list a caller is holding can be refreshed
   * the moment a note is added or corrected, instead of on the next fetch.
   */
  onNoteAdded?: (summary: string | null) => void;
}

const formatWhen = (iso: string | null): string => {
  if (!iso) return 'Date unknown';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'Date unknown';

  return when.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const FIELD_CLASS =
  'w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

/**
 * A booking's internal log: every note on it, who wrote it and when.
 *
 * Any employee who can open the booking can correct any note — shifts hand over, and whoever spots
 * a mistake is rarely the one who made it. What is permanent is the record, not the wording: the
 * version an edit replaces is kept and shown under the note, and nothing is ever deleted.
 */
const InternalNotesLog: React.FC<InternalNotesLogProps> = ({ bookingId, compact = false, onNoteAdded }) => {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [showHistoryFor, setShowHistoryFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await bookingService.getInternalNotes(bookingId);
      setNotes(response.data?.notes ?? []);
      setCategories(response.data?.categories ?? {});
    } catch {
      setError('Could not load the notes for this booking.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const failureText = (err: unknown, fallback: string): string =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

  const publishSummary = useCallback(
    async (summary: string | null | undefined) => {
      if (summary === undefined) return;
      onNoteAdded?.(summary);

      try {
        const cached = await bookingCacheService.getBookingFromCache(bookingId);
        if (cached) {
          await bookingCacheService.updateBookingInCache({ ...cached, internal_notes: summary ?? undefined });
        }
      } catch {
        // the note is already saved; a stale badge elsewhere is not worth failing the save over
      }
    },
    [bookingId, onNoteAdded]
  );

  const save = async () => {
    const text = body.trim();
    if (!text || saving) return;

    setSaving(true);
    setError(null);
    try {
      const response = await bookingService.addInternalNote(bookingId, text, category || null);
      if (response.success && response.data) {
        setNotes(current => [response.data as InternalNote, ...current]);
        setBody('');
        setCategory('');
        setAdding(false);
        await publishSummary(response.data.internal_notes ?? null);
      } else {
        setError(response.message || 'The note could not be saved.');
      }
    } catch (err) {
      setError(failureText(err, 'The note could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (note: InternalNote) => {
    setEditingId(note.id);
    setEditBody(note.body);
    setEditCategory(note.category ?? '');
    setError(null);
  };

  const saveEdit = async (noteId: number) => {
    const text = editBody.trim();
    if (!text || saving) return;

    setSaving(true);
    setError(null);
    try {
      const response = await bookingService.updateInternalNote(bookingId, noteId, text, editCategory || null);
      if (response.success && response.data) {
        const updated = response.data as InternalNote;
        setNotes(current => current.map(note => (note.id === noteId ? updated : note)));
        setEditingId(null);
        await publishSummary(response.data.internal_notes ?? null);
      } else {
        setError(response.message || 'The change could not be saved.');
      }
    } catch (err) {
      setError(failureText(err, 'The change could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = Object.entries(categories);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-gray-700">
          <StickyNote className="h-4 w-4 text-amber-600" />
          Internal notes
        </h4>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add note
          </button>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-500">
        <Lock className="mt-px h-3 w-3 shrink-0" />
        Staff only — never shown to the guest. Anyone here can correct a note; the version it
        replaces is kept with their name on it, and nothing is ever deleted.
      </p>

      {adding && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <select value={category} onChange={event => setCategory(event.target.value)} className={FIELD_CLASS}>
            <option value="">What is this about? (optional)</option>
            {categoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
            rows={3}
            maxLength={5000}
            autoFocus
            placeholder="What happened, and anything the next shift needs to know."
            className={FIELD_CLASS}
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setBody('');
                setCategory('');
                setError(null);
              }}
              className="min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || body.trim() === ''}
              className="min-h-[36px] rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-gray-400">No internal notes on this booking yet.</p>
      ) : (
        <ol className={compact ? 'space-y-1.5' : 'space-y-2'}>
          {notes.map(note => (
            <li key={note.id} className="rounded-lg border border-gray-200 bg-white p-2.5">
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold text-gray-900">{note.employee_name}</span>
                <span className="text-[11px] tabular-nums text-gray-500">{formatWhen(note.created_at)}</span>
                {note.category_label && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    {note.category_label}
                  </span>
                )}
                {note.edited_at && (
                  <span className="text-[10px] italic text-gray-400">
                    edited {formatWhen(note.edited_at)}
                    {note.edited_by_name ? ` by ${note.edited_by_name}` : ''}
                  </span>
                )}

                <span className="ml-auto flex items-center gap-1">
                  {note.revisions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHistoryFor(current => (current === note.id ? null : note.id))}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded px-1.5 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                      <History className="h-3 w-3" />
                      {showHistoryFor === note.id ? 'Hide' : `${note.revisions.length} earlier`}
                    </button>
                  )}
                  {note.can_edit && editingId !== note.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded px-1.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-50"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </span>
              </div>

              {editingId === note.id ? (
                <div className="space-y-2">
                  <select
                    value={editCategory}
                    onChange={event => setEditCategory(event.target.value)}
                    className={FIELD_CLASS}
                  >
                    <option value="">What is this about? (optional)</option>
                    {categoryOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={editBody}
                    onChange={event => setEditBody(event.target.value)}
                    rows={3}
                    maxLength={5000}
                    autoFocus
                    className={FIELD_CLASS}
                  />

                  <p className="text-[10px] text-gray-500">
                    The version you are replacing is kept, with your name on the change.
                  </p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setError(null);
                      }}
                      className="min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit(note.id)}
                      disabled={saving || editBody.trim() === ''}
                      className="min-h-[36px] rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save change'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line break-words text-sm leading-snug text-gray-700">{note.body}</p>
              )}

              {showHistoryFor === note.id && note.revisions.length > 0 && (
                <ol className="mt-2 space-y-1.5 border-l-2 border-gray-200 pl-2.5">
                  {note.revisions.map(revision => (
                    <li key={revision.id}>
                      <p className="text-[10px] text-gray-500">
                        Replaced {formatWhen(revision.created_at)} by {revision.edited_by_name}
                        {revision.category_label ? ` · was ${revision.category_label}` : ''}
                      </p>
                      <p className="whitespace-pre-line break-words text-xs leading-snug text-gray-500 line-through decoration-gray-300">
                        {revision.body}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default InternalNotesLog;
