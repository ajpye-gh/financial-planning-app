interface HousingToggleProps {
  ownsHome: boolean;
  onChange: (ownsHome: boolean) => void;
}

/** Own-vs-rent isn't just display filtering (see baseFields.ts's visibleIf on the home-value/mortgage
 *  fields) - it changes how housing cost inflates in the model (model.ts's fixedHousing vs
 *  inflatingHousingBase), so it needs to be a real, always-visible control, not a one-time answer. */
export function HousingToggle({ ownsHome, onChange }: Readonly<HousingToggleProps>) {
  return (
    <div className="housing-toggle">
      <span className="housing-toggle__label">Housing</span>
      <div className="chart-toggle">
        <button
          type="button"
          className={ownsHome ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange(true)}
        >
          Own
        </button>
        <button
          type="button"
          className={!ownsHome ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange(false)}
        >
          Rent
        </button>
      </div>
    </div>
  );
}
