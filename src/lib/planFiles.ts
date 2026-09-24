import { isValidPlan, type Plan } from './plans';

export const PYF_EXTENSION = '.pyf';

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}

interface FileSystemWritableStreamLike {
  write: (data: BlobPart) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableStreamLike>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\]/g, '-').trim() || 'plan';
}

function downloadViaAnchor(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Exports a plan as a `.pyf` (made-up extension) JSON file. Prefers the File System Access API's
 *  native Save dialog (Chromium); falls back to an anchor download elsewhere, since Safari/Firefox
 *  don't implement `showSaveFilePicker`. */
export async function exportPlanFile(name: string, plan: Plan): Promise<void> {
  const fileName = `${sanitizeFileName(name)}${PYF_EXTENSION}`;
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'Pyenancial plan', accept: { 'application/json': [PYF_EXTENSION] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled the picker - not an error.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      throw err;
    }
  }

  downloadViaAnchor(fileName, blob);
}

/** FileReader rather than `Blob.text()` - broader support (older Safari, and notably jsdom under
 *  Jest, don't implement `Blob.prototype.text`). */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read "${file.name}".`));
    reader.readAsText(file);
  });
}

/** Reads and validates a `.pyf` file, throwing a message suitable for display if it isn't one. */
export async function parsePlanFile(file: File): Promise<Plan> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFileAsText(file));
  } catch {
    throw new Error(`"${file.name}" isn't valid JSON.`);
  }
  if (!isValidPlan(parsed)) {
    throw new Error(`"${file.name}" isn't a valid plan file.`);
  }
  return parsed;
}
