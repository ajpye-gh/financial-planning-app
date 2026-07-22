import type { Verdict } from '../../lib/model';

interface VerdictBannerProps {
  verdict: Verdict;
}

export function VerdictBanner({ verdict }: Readonly<VerdictBannerProps>) {
  return (
    <div className={`verdict-banner verdict-banner--${verdict.tone}`}>
      <span className="verdict-banner__headline">{verdict.headline}</span> {verdict.detail}
    </div>
  );
}
