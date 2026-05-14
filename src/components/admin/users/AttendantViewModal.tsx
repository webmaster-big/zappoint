import { X, User, Mail, Phone, Briefcase, Building2, Clock, Calendar, Hash } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { ManageAttendantsAttendant } from '../../../types/ManageAttendants.types';

interface AttendantViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendant: ManageAttendantsAttendant | null;
}

const Field = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="p-1.5 rounded-lg bg-gray-100 flex-shrink-0 mt-0.5">
      <Icon className="w-3.5 h-3.5 text-gray-500" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 break-words">{value || '—'}</p>
    </div>
  </div>
);

const AttendantViewModal = ({ isOpen, onClose, attendant }: AttendantViewModalProps) => {
  const { themeColor } = useThemeColor();

  if (!isOpen || !attendant) return null;

  const statusColor =
    attendant.status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-gray-100 text-gray-600';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${themeColor}-100`}>
              <User className={`w-5 h-5 text-${themeColor}-600`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {attendant.firstName} {attendant.lastName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                  {attendant.status}
                </span>
                <span className="text-xs text-gray-400">{attendant.employeeId}</span>
              </div>
            </div>
          </div>
          <StandardButton
            onClick={onClose}
            variant="ghost"
            size="sm"
            icon={X}
            className="text-gray-400 hover:text-gray-600"
          />
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Contact */}
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={Mail} label="Email" value={attendant.email} />
              <Field icon={Phone} label="Phone" value={attendant.phone} />
            </div>
          </section>

          {/* Role & Department */}
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Role & Department
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={Briefcase} label="Position" value={attendant.position} />
              <Field icon={Building2} label="Department" value={attendant.department} />
              <Field icon={Clock} label="Shift" value={attendant.shift} />
              <Field icon={Hash} label="Employee ID" value={attendant.employeeId} />
            </div>
          </section>

          {/* Dates */}
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Dates
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                icon={Calendar}
                label="Hire Date"
                value={
                  attendant.hireDate
                    ? new Date(attendant.hireDate).toLocaleDateString()
                    : '—'
                }
              />
              <Field
                icon={Calendar}
                label="Created"
                value={
                  attendant.createdAt
                    ? new Date(attendant.createdAt).toLocaleDateString()
                    : '—'
                }
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <StandardButton onClick={onClose} variant="primary" size="md">
            Close
          </StandardButton>
        </div>
      </div>
    </div>
  );
};

export default AttendantViewModal;
