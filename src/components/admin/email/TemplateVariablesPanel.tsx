import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Code, Copy, Info } from 'lucide-react';
import type { TemplateVariableGroup } from '../../../utils/emailTemplateOptions';

interface TemplateVariablesPanelProps {
  groups: TemplateVariableGroup[];
  targetLabel: string;
  onInsert: (name: string) => void;
  iconClassName: string;
  readOnly?: boolean;
}

const TemplateVariablesPanel = ({ groups, targetLabel, onInsert, iconClassName, readOnly = false }: TemplateVariablesPanelProps) => {
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);
  const [copyState, setCopyState] = useState<{ name: string; ok: boolean } | null>(null);
  const copyTimer = useRef<number | null>(null);
  const shownGroup =
    openGroup === undefined ? groups[0]?.key ?? null : groups.some((group) => group.key === openGroup) ? openGroup : null;

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  const showCopyState = (name: string, ok: boolean) => {
    setCopyState({ name, ok });
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyState(null), 2000);
  };

  const copyVariable = (variable: string) => {
    const writing = navigator.clipboard?.writeText(`{{ ${variable} }}`);

    if (!writing) {
      showCopyState(variable, false);
      return;
    }

    writing.then(() => showCopyState(variable, true), () => showCopyState(variable, false));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:sticky lg:top-24">
      <div className="flex items-center gap-2 mb-4">
        <Code className={`w-5 h-5 ${iconClassName}`} />
        <h2 className="text-lg font-semibold text-gray-900">Template Variables</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {readOnly ? (
          'This template is read-only, so variables cannot be added to it. You can still copy a variable to use somewhere else.'
        ) : (
          <>
            Click a variable to add it to the <span className="font-medium text-gray-700">{targetLabel}</span>. Click in another field first
            to add it there instead.
          </>
        )}
      </p>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenGroup(shownGroup === group.key ? null : group.key)}
              aria-expanded={shownGroup === group.key}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-700">{group.title}</span>
              {shownGroup === group.key ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {shownGroup === group.key && (
              <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {group.note && <p className="text-xs text-gray-500">{group.note}</p>}
                {group.variables.map((variable) => (
                  <div
                    key={variable.name}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 group"
                  >
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onInsert(variable.name)}
                        disabled={readOnly}
                        className={`text-sm font-mono block truncate max-w-full text-left ${
                          readOnly ? 'text-gray-600 cursor-default' : 'text-blue-600 hover:underline'
                        }`}
                      >
                        {'{{ ' + variable.name + ' }}'}
                      </button>
                      <p className="text-xs text-gray-500 truncate" title={variable.description}>
                        {variable.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => copyVariable(variable.name)}
                      className={`ml-2 p-1.5 text-gray-400 hover:text-gray-600 focus:opacity-100 transition-opacity ${
                        readOnly ? '' : 'sm:opacity-0 sm:group-hover:opacity-100'
                      }`}
                      title="Copy to clipboard"
                    >
                      {copyState?.name === variable.name ? (
                        <span className={`text-xs ${copyState.ok ? 'text-green-600' : 'text-red-600'}`}>{copyState.ok ? 'Copied!' : 'Copy failed'}</span>
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Variables are automatically replaced with recipient-specific data when emails are sent. Use them to personalize your emails.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TemplateVariablesPanel;
