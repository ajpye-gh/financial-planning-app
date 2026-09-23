interface SocialSecurityToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/** Same reasoning as HousingToggle.tsx/FilingStatusToggle.tsx: Social Security isn't guaranteed
 *  income for every plan (already-ineligible, a foreign retiree, a deliberately conservative FIRE
 *  plan, etc.), so it needs a real on/off control - not just "drag the benefit slider to $0," which
 *  still nominally counts it as part of the model. When off, the benefit slider below is disabled
 *  and Social Security is excluded entirely from the projection and the income breakdown table. */
export function SocialSecurityToggle({ enabled, onChange }: Readonly<SocialSecurityToggleProps>) {
  return (
    <div className="housing-toggle">
      <span className="housing-toggle__label">Social Security</span>
      <div className="chart-toggle">
        <button
          type="button"
          className={enabled ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange(true)}
        >
          On
        </button>
        <button
          type="button"
          className={!enabled ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange(false)}
        >
          Off
        </button>
      </div>
    </div>
  );
}
