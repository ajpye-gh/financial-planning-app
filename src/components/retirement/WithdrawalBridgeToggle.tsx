interface WithdrawalBridgeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/** Only rendered when retiring before Social Security starts (see RetirementPage.tsx's own
 *  gating) - the "Social Security bridge" strategy this controls doesn't mean anything otherwise.
 *  Same on/off pattern as SocialSecurityToggle.tsx: when on, the Traditional projection cuts its
 *  withdrawal back by the (inflated) Social Security benefit from the year it starts onward, since
 *  Social Security now covers that difference in income - see retirement.ts's ssBridge option. */
export function WithdrawalBridgeToggle({ enabled, onChange }: Readonly<WithdrawalBridgeToggleProps>) {
  return (
    <div className="housing-toggle">
      <span className="housing-toggle__label">Reduce Traditional withdrawals once Social Security starts</span>
      <div className="chart-toggle">
        <button
          type="button"
          aria-label="Enable Social Security bridge"
          className={enabled ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange(true)}
        >
          On
        </button>
        <button
          type="button"
          aria-label="Disable Social Security bridge"
          className={!enabled ? 'chart-toggle__tab chart-toggle__tab--active' : 'chart-toggle__tab'}
          onClick={() => onChange(false)}
        >
          Off
        </button>
      </div>
    </div>
  );
}
