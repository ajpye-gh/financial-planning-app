import { exportPlanFile, parsePlanFile, PYF_EXTENSION } from '@src/lib/planFiles';
import { freshPlan } from '@src/lib/plans';

describe('parsePlanFile', () => {
  it('parses and validates a well-formed .pyf file', async () => {
    const plan = freshPlan();
    const file = new File([JSON.stringify(plan)], 'My plan.pyf', { type: 'application/json' });

    await expect(parsePlanFile(file)).resolves.toEqual(plan);
  });

  it('rejects a file that is not valid JSON', async () => {
    const file = new File(['not json'], 'broken.pyf', { type: 'application/json' });

    await expect(parsePlanFile(file)).rejects.toThrow(/valid JSON/);
  });

  it('rejects valid JSON that is not a valid plan shape', async () => {
    const file = new File([JSON.stringify({ nope: true })], 'broken.pyf', { type: 'application/json' });

    await expect(parsePlanFile(file)).rejects.toThrow(/valid plan file/);
  });
});

describe('exportPlanFile', () => {
  afterEach(() => {
    delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    jest.restoreAllMocks();
  });

  it('uses the native Save dialog when available', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const createWritable = jest.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = jest.fn().mockResolvedValue({ createWritable });
    window.showSaveFilePicker = showSaveFilePicker;

    await exportPlanFile('My plan', freshPlan());

    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: `My plan${PYF_EXTENSION}` }),
    );
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('silently no-ops if the user cancels the native Save dialog', async () => {
    window.showSaveFilePicker = jest.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));

    await expect(exportPlanFile('My plan', freshPlan())).resolves.toBeUndefined();
  });

  it('falls back to an anchor download when the native Save dialog is unavailable', async () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = jest.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { click, set href(_v: string) {}, set download(_v: string) {} } as unknown as HTMLElement;
      }
      return originalCreateElement(tag);
    });

    await exportPlanFile('My/plan', freshPlan());

    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
