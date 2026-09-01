import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { suggestEmails, type EmailSuggestion } from '../../utils/emailDomains';

interface EmailInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  extraDomains?: string[];
  suppressSuggestions?: boolean;
  wrapperClassName?: string;
  listClassName?: string;
  optionClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

interface Placement {
  top: number;
  left: number;
  width: number;
}

const GAP = 4;
const MARGIN = 8;

const setNativeValue = (el: HTMLInputElement, next: string): void => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(el, next);
  } else {
    el.value = next;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const EmailInput: React.FC<EmailInputProps> = ({
  extraDomains,
  suppressSuggestions = false,
  wrapperClassName = '',
  listClassName = '',
  optionClassName = '',
  inputRef,
  className = '',
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  disabled,
  readOnly,
  ...rest
}) => {
  const localRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [mirror, setMirror] = useState('');
  const listId = useId();

  const currentValue = value !== undefined && value !== null ? String(value) : mirror;

  const suggestions = useMemo<EmailSuggestion[]>(() => {
    if (disabled || readOnly || suppressSuggestions) return [];
    return suggestEmails(currentValue, { extraDomains });
  }, [currentValue, disabled, readOnly, suppressSuggestions, extraDomains]);

  const open = focused && !dismissed && suggestions.length > 0;

  const attachRef = useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      if (typeof inputRef === 'function') {
        inputRef(node);
      } else if (inputRef && typeof inputRef === 'object') {
        (inputRef as React.RefObject<HTMLInputElement | null>).current = node;
      }
    },
    [inputRef]
  );

  const place = useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const listH = listRef.current?.offsetHeight ?? 0;
    let top = r.bottom + GAP;
    if (listH > 0 && top + listH > vh - MARGIN && r.top - GAP - listH > MARGIN) {
      top = r.top - GAP - listH;
    }
    const left = Math.max(MARGIN, Math.min(r.left, vw - r.width - MARGIN));
    setPlacement({ top, left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    place();
  }, [open, suggestions.length, place]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onResize = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, place]);

  useEffect(() => {
    setHighlight(-1);
  }, [currentValue]);

  const commit = (suggestion: EmailSuggestion) => {
    const el = localRef.current;
    if (!el) return;
    setNativeValue(el, suggestion.email);
    setMirror(suggestion.email);
    setDismissed(true);
    setHighlight(-1);
    el.focus();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMirror(event.target.value);
    setDismissed(false);
    onChange?.(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    setDismissed(false);
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    setHighlight(-1);
    onBlur?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(true);
        setHighlight(-1);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && highlight >= 0) {
        event.preventDefault();
        if (event.key === 'Enter') event.stopPropagation();
        commit(suggestions[highlight]);
        return;
      }
    }
    onKeyDown?.(event);
  };

  const hasCorrection = suggestions.some((s) => s.kind === 'correction');

  return (
    <div className={`relative w-full ${wrapperClassName}`.trim()}>
      <input
        {...rest}
        ref={attachRef}
        type="email"
        className={className}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && highlight >= 0 ? `${listId}-${highlight}` : undefined}
      />
      {open
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className={`fixed bg-white border border-gray-300 rounded-lg shadow-lg max-h-56 overflow-y-auto py-1 ${listClassName}`.trim()}
              style={{
                top: placement ? placement.top : 0,
                left: placement ? placement.left : 0,
                width: placement ? placement.width : undefined,
                visibility: placement ? 'visible' : 'hidden',
                zIndex: 99999,
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              {hasCorrection ? (
                <li className="px-3 py-1 text-xs font-medium text-gray-500 select-none">Did you mean</li>
              ) : null}
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.domain}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlight}
                  onClick={() => commit(suggestion)}
                  onMouseEnter={() => setHighlight(index)}
                  className={`px-3 py-2 text-sm cursor-pointer truncate ${
                    index === highlight ? 'bg-blue-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                  } ${optionClassName}`.trim()}
                >
                  {suggestion.email}
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
};

export default EmailInput;
