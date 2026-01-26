import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Pencil, 
  Trash2, 
  Power, 
  GripVertical,
  Save,
  X,
  Package
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { globalNoteService, type GlobalNote } from '../../../services/GlobalNoteService';
import { packageService, type Package as PackageType } from '../../../services/PackageService';
import Toast from '../../../components/ui/Toast';

const GlobalNotes: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [notes, setNotes] = useState<GlobalNote[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<GlobalNote | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    package_ids: [] as number[],
    is_active: true,
    display_order: 0
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch notes and packages on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [notesRes, packagesRes] = await Promise.all([
          globalNoteService.getGlobalNotes(),
          packageService.getPackages({ per_page: 100 })
        ]);
        
        setNotes(notesRes.data || []);
        setPackages(packagesRes.data.packages || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setToast({ message: 'Failed to load data', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenForm = (note?: GlobalNote) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title || '',
        content: note.content,
        package_ids: note.package_ids || [],
        is_active: note.is_active,
        display_order: note.display_order
      });
    } else {
      setEditingNote(null);
      setFormData({
        title: '',
        content: '',
        package_ids: [],
        is_active: true,
        display_order: notes.length
      });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setFormData({
      title: '',
      content: '',
      package_ids: [],
      is_active: true,
      display_order: 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      showToast('Note content is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = {
        title: formData.title.trim() || undefined,
        content: formData.content.trim(),
        package_ids: formData.package_ids.length > 0 ? formData.package_ids : undefined,
        is_active: formData.is_active,
        display_order: formData.display_order
      };

      if (editingNote) {
        const response = await globalNoteService.updateGlobalNote(editingNote.id, submitData);
        setNotes(prev => prev.map(n => n.id === editingNote.id ? response.data : n));
        showToast('Note updated successfully', 'success');
      } else {
        const response = await globalNoteService.createGlobalNote(submitData);
        setNotes(prev => [...prev, response.data]);
        showToast('Note created successfully', 'success');
      }
      
      handleCloseForm();
    } catch (error) {
      console.error('Error saving note:', error);
      showToast('Failed to save note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    
    try {
      await globalNoteService.deleteGlobalNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      showToast('Note deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting note:', error);
      showToast('Failed to delete note', 'error');
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const response = await globalNoteService.toggleStatus(id);
      setNotes(prev => prev.map(n => n.id === id ? response.data : n));
      showToast(`Note ${response.data.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (error) {
      console.error('Error toggling status:', error);
      showToast('Failed to update status', 'error');
    }
  };

  const handlePackageToggle = (packageId: number) => {
    setFormData(prev => ({
      ...prev,
      package_ids: prev.package_ids.includes(packageId)
        ? prev.package_ids.filter(id => id !== packageId)
        : [...prev.package_ids, packageId]
    }));
  };

  const getPackageNames = (packageIds: number[] | null): string => {
    if (!packageIds || packageIds.length === 0) return 'All packages (Global)';
    const names = packageIds
      .map(id => packages.find(p => p.id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return 'All packages (Global)';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  if (loading) {
    return (
      <div className="px-6 py-8 flex items-center justify-center min-h-96">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/packages">
            <StandardButton variant="ghost" size="sm" icon={ArrowLeft} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Global Notes</h1>
            <p className="text-gray-600 mt-1">Manage notes displayed to customers during booking</p>
          </div>
        </div>
        <StandardButton
          variant="primary"
          size="md"
          icon={Plus}
          onClick={() => handleOpenForm()}
        >
          Add Note
        </StandardButton>
      </div>

      {/* Info Box */}
      <div className={`mb-6 p-4 bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg`}>
        <div className="flex items-start gap-3">
          <FileText className={`h-5 w-5 text-${fullColor} mt-0.5`} />
          <div className="text-sm">
            <p className={`font-medium text-${themeColor}-900`}>How Global Notes Work</p>
            <ul className={`mt-1 text-${themeColor}-700 list-disc list-inside space-y-1`}>
              <li><strong>Global notes</strong> (no packages selected) appear on ALL package bookings</li>
              <li><strong>Package-specific notes</strong> only appear on selected packages</li>
              <li>Notes are displayed to customers during booking and included in confirmation emails</li>
              <li>Example use: "A 4.87% processing fee applies to all transactions"</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className={`w-16 h-16 rounded-full bg-${themeColor}-100 flex items-center justify-center mb-4`}>
              <FileText className={`w-8 h-8 text-${fullColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No notes yet</h3>
            <p className="text-gray-600 text-sm mb-6 text-center max-w-sm">
              Create your first note to display important information to customers during booking
            </p>
            <StandardButton
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => handleOpenForm()}
            >
              Add Note
            </StandardButton>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notes
              .sort((a, b) => a.display_order - b.display_order)
              .map((note) => (
                <div 
                  key={note.id} 
                  className={`p-4 hover:bg-gray-50 transition-colors ${!note.is_active ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-1">
                      <GripVertical className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {note.title && (
                          <h3 className="font-semibold text-gray-900">{note.title}</h3>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          note.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {note.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {(!note.package_ids || note.package_ids.length === 0) && (
                          <span className={`px-2 py-0.5 text-xs rounded-full bg-${themeColor}-100 text-${themeColor}-800`}>
                            Global
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                      
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Package className="h-3 w-3" />
                        <span>{getPackageNames(note.package_ids)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(note.id)}
                        className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                          note.is_active ? 'text-green-600' : 'text-gray-400'
                        }`}
                        title={note.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenForm(note)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingNote ? 'Edit Note' : 'Add New Note'}
                </h2>
                <button 
                  onClick={handleCloseForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Title (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Processing Fee Notice"
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="e.g., A 4.87% processing fee will be applied to all card transactions."
                  rows={4}
                  className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  required
                />
              </div>

              {/* Package Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apply to Packages
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Leave empty to apply to ALL packages (global note)
                </p>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {packages.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">No packages available</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {packages.map((pkg) => (
                        <label
                          key={pkg.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.package_ids.includes(pkg.id)}
                            onChange={() => handlePackageToggle(pkg.id)}
                            className={`rounded border-gray-300 text-${themeColor}-600 focus:ring-${themeColor}-500`}
                          />
                          <span className="text-sm text-gray-900">{pkg.name}</span>
                          {pkg.category && (
                            <span className="text-xs text-gray-500">({pkg.category})</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {formData.package_ids.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">
                    {formData.package_ids.length} package(s) selected
                  </p>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-${themeColor}-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-${themeColor}-600`}></div>
                </label>
                <span className="text-sm text-gray-700">Active</span>
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  min="0"
                  className={`w-24 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                />
                <p className="mt-1 text-xs text-gray-500">Lower numbers display first</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <StandardButton
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleCloseForm}
                  disabled={submitting}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={Save}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingNote ? 'Update Note' : 'Create Note'}
                </StandardButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default GlobalNotes;
