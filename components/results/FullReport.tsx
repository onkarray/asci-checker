'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import ScoreGauge from './ScoreGauge';
import ViolationCard from './ViolationCard';
import { AnalysisResult } from '@/components/analysis/AnalysisRunner';

interface FullReportProps {
  result: AnalysisResult;
  adCategory: string;
  adFormat: string;
  platform: string;
  onCheckAnother: () => void;
}

const VERDICT_CONFIG: Record<string, { label: string; className: string }> = {
  COMPLIANT: { label: 'COMPLIANT', className: 'bg-green-600 text-white' },
  NEEDS_REVISION: { label: 'NEEDS REVISION', className: 'bg-amber-500 text-white' },
  NON_COMPLIANT: { label: 'NON-COMPLIANT', className: 'bg-red-600 text-white' },
  AUTO_FAIL: { label: 'AUTO-FAIL', className: 'bg-red-700 text-white' },
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

export default function FullReport({
  result,
  adCategory,
  adFormat,
  platform,
  onCheckAnother,
}: FullReportProps) {
  const [downloading, setDownloading] = useState(false);
  const vc = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.NON_COMPLIANT;

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { generatePDF } = await import('@/lib/pdf-generator');
      const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
      const pdfBytes = await generatePDF(result, {
        adCategory,
        adFormat,
        platform,
        dateChecked: today,
      });
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asci-compliance-report.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
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

      {/* Full summary */}
      <p className="text-muted-foreground text-sm text-center max-w-lg mx-auto">
        {result.full_summary}
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

      <Separator />

      {/* All violations */}
      {result.violations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">
            All Violations ({result.violations.length})
          </h3>
          {result.violations.map(v => (
            <ViolationCard key={v.id} violation={v} blurFix={false} />
          ))}
        </div>
      )}

      {/* Compliant elements */}
      {result.compliant_elements?.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <h3 className="font-semibold text-green-700">What You Got Right</h3>
          <ul className="space-y-2">
            {result.compliant_elements.map((el, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-green-600 mt-0.5 flex-shrink-0">✓</span>
                <span>{el}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="flex-1 border border-primary text-primary py-3 rounded-lg font-semibold text-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
        >
          {downloading ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
        <button
          onClick={onCheckAnother}
          className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          Check Another Ad
        </button>
      </div>
    </div>
  );
}
