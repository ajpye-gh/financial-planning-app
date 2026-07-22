interface Metric {
  id: string;
  label: string;
  value: string;
  tone?: 'danger' | 'success';
}

interface MetricCardsProps {
  metrics: Metric[];
}

export function MetricCards({ metrics }: Readonly<MetricCardsProps>) {
  return (
    <div className="metric-row">
      {metrics.map((metric) => (
        <div className="metric-card" key={metric.id}>
          <div className="metric-card__label">{metric.label}</div>
          <div
            className={
              metric.tone ? `metric-card__value metric-card__value--${metric.tone}` : 'metric-card__value'
            }
          >
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export type { Metric };
