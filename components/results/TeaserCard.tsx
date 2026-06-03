'use client';

import { Progress } from '@/components/ui/progress';
import ScoreGauge from './ScoreGauge';
import ViolationCard from './ViolationCard';
import { AnalysisResult } from '@/components/analysis/AnalysisRunner';

interface TeaserCardProps {
  result: AnalysisResult;
  onUnlockClick: () => void;
}

const VERDICT_CONFIG: Record<string, { label: string; variant: string; className: string }> = {
  COMPLIANT: { label: 'COMPLIANT', variant: 'default', className: 'bg-green-600 text-white' },
  NEEDS_REVISION: { label: 'NEEDS REVISION', variant: 'default', className: 'bg-amber-500 text-white' },
  NON_COMPLIANT: { label: 'NON-COMPLIANT', variant: 'destructive', className: 'bg-red-600 text-white' },
  AUTO_FAIL: { label: 'AUTO-FAIL', variant: 'destructive', className: 'bg-red-700 text-white' },
};

const CATEGORY_LABELS: Record<string, string> = {
  claim_substantiation: 'Claim Substantiation',
  disclosure_compliance: 'Disclosure Compliance',
  prohibited_category_check: 'Prohibited Category',
  sector_specific: 'Sector-Specific Rules',
  language_and_framing: 'Language & Framing',
};

const CATEGORY_MAX: Record<string, number> = {
  claim_substantiation: 25,
  disclosure_compliance: 25,
  prohibited_category_check: 20,
  sector_specific: 20,
  language_and_framing: 10,
};

export default function TeaserCard({ result, onUnlockClick }: TeaserCardProps) {
  const vc = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.NON_COMPLIANT;
  const highViolations = result.violations.filter(v => v.severity === 'HIGH').slice(0, 2);

  return (
    <div className="space-y-6 pb-24">
      {/* Score + Verdict */}
      <div className="flex flex-col items-center gap-3 py-4">
        <ScoreGauge score={result.overall_score} verdict={result.verdict} size="lg" />
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${vc.className}`}>
          {vc.label}
        </span>
        {result.verdict === 'AUTO_FAIL' && result.auto_fail_reason && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-sm text-red-800 text-center max-w-md">
            <strong>Auto-Fail:</strong> {result.auto_fail_reason}
            {result.escalation_required && result.escalation_body && (
              <span className="block mt-1 font-semibold">
                Escalated to: {result.escalation_body}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Teaser summary */}
      <p className="text-muted-foreground text-center text-sm max-w-lg mx-auto">
        {result.teaser_summary}
      </p>

      {/* Category scores */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Category Breakdown</h3>
        {Object.entries(result.category_scores).map(([key, score]) => {
          const max = CATEGORY_MAX[key] || 25;
          const pct = Math.round((score / max) * 100);
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{CATEGORY_LABELS[key] || key}</span>
                <span className="text-muted-foreground">{score}/{max}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </div>

      {/* Top 2 HIGH violations (fix blurred) */}
      {highViolations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            Top Issues
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({result.violations.length} total violation{result.violations.length !== 1 ? 's' : ''})
            </span>
          </h3>
          {highViolations.map(v => (
            <ViolationCard key={v.id} violation={v} blurFix />
          ))}
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm">Get your complete fix report — free</p>
            <p className="text-xs text-muted-foreground">
              {result.violations.length - Math.min(highViolations.length, 2)} more violations + full fix suggestions
            </p>
          </div>
          <button
            onClick={onUnlockClick}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            Enter your email →
          </button>
        </div>
      </div>
    </div>
  );
}
