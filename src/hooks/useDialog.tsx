import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';

interface ConfirmOptions {
  /** Label for the affirmative action - always describe what it *does* ("Save as new plan"), never
   *  generic "OK", so the two buttons can't be misread as which one continues vs. which discards. */
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
}

interface PromptOptions {
  confirmLabel?: string;
  cancelLabel?: string;
}

type DialogState =
  | { kind: 'confirm'; message: string; options: ConfirmOptions; resolve: (value: boolean) => void }
  | {
      kind: 'prompt';
      message: string;
      defaultValue: string;
      options: Required<PromptOptions>;
      resolve: (value: string | null) => void;
    }
  | null;

/** In-app replacement for `window.confirm`/`window.prompt` styled like the rest of the UI, with
 *  caller-chosen button labels instead of native "OK"/"Cancel" (which can't express asymmetric
 *  actions like "Save as new plan" vs. "Discard changes" - see PlanControls). Renders nothing until
 *  a dialog is requested; mount the returned `dialog` node once, anywhere in the tree. */
export function useDialog() {
  const [state, setState] = useState<DialogState>(null);
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((message: string, options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ kind: 'confirm', message, options, resolve });
    });
  }, []);

  const prompt = useCallback((message: string, defaultValue: string, options?: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputValue(defaultValue);
      setState({
        kind: 'prompt',
        message,
        defaultValue,
        options: { confirmLabel: options?.confirmLabel ?? 'Save', cancelLabel: options?.cancelLabel ?? 'Cancel' },
        resolve,
      });
    });
  }, []);

  const resolveAndClose = (result: boolean | string | null) => {
    setState((current) => {
      if (!current) {
        return current;
      }
      current.resolve(result as never);
      return null;
    });
  };

  // Capture phase, and own document-level Escape handling entirely (rather than a per-input
  // onKeyDown) so it fires - and stops propagating - before any other Escape listener further up
  // the tree, such as PlanMenu's "close the whole hamburger panel" handler. Without this, dismissing
  // a dialog with Escape also closed the menu underneath it.
  useEffect(() => {
    if (!state) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        resolveAndClose(state.kind === 'confirm' ? false : null);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [state]);

  let dialog: ReactNode = null;
  if (state) {
    const handleOverlayMouseDown = (event: MouseEvent) => {
      if (event.target === event.currentTarget) {
        resolveAndClose(state.kind === 'confirm' ? false : null);
      }
    };

    dialog = (
      <div className="dialog-overlay" onMouseDown={handleOverlayMouseDown}>
        <div className="dialog-box" role={state.kind === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true">
          <p className="dialog-message">{state.message}</p>
          {state.kind === 'prompt' && (
            <input
              autoFocus
              type="text"
              className="dialog-input"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  resolveAndClose(inputValue.trim());
                }
              }}
            />
          )}
          <div className="dialog-actions">
            {state.kind === 'confirm' ? (
              <>
                <button type="button" onClick={() => resolveAndClose(false)}>
                  {state.options.cancelLabel}
                </button>
                <button
                  type="button"
                  className={state.options.tone === 'danger' ? 'danger' : 'primary'}
                  onClick={() => resolveAndClose(true)}
                >
                  {state.options.confirmLabel}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => resolveAndClose(null)}>
                  {state.options.cancelLabel}
                </button>
                <button type="button" className="primary" onClick={() => resolveAndClose(inputValue.trim())}>
                  {state.options.confirmLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return { confirm, prompt, dialog };
}
