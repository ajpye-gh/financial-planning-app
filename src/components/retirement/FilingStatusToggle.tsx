import type { FilingStatus } from '../../lib/tax';

interface FilingStatusToggleProps {
  filingStatus: FilingStatus;
  onChange: (filingStatus: FilingStatus) => void;
}

/** Same reasoning as HousingToggle.tsx: filing status isn't just display filtering, it changes
 *  which federal bracket table and standard deduction the tax estimate uses (see tax.ts), so it
 *  needs to be a real, always-visible control, not a one-time answer. */
export function FilingStatusToggle({ filingStatus, onChange }: Readonly<FilingStatusToggleProps>) {
  return (
    <div className="housing-toggle">
      <span className="housing-toggle__label">Filing status</span>
      <div className="chart-toggle">
        <button
          type="button"
          className={filingStatus === 'single' ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange('single')}
        >
          Single
        </button>
        <button
          type="button"
          className={filingStatus === 'marriedJoint' ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange('marriedJoint')}
        >
          Married
        </button>
      </div>
    </div>
  );
}
