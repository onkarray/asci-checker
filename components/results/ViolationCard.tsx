'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface Violation {
  id: string;
  module: string;
  rule_reference: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  offending_element: string;
  why_its_a_violation: string;
  fix_suggestion: string;
}

interface ViolationCardProps {
  violation: Violation;
  blurFix?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: 'destructive',
  MEDIUM: 'outline',
  LOW: 'secondary',
};

const SEVERITY_BG: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50',
  MEDIUM: 'border-amber-200 bg-amber-50',
  LOW: 'border-slate-200 bg-slate-50',
};

export default function ViolationCard({ violation, blurFix = false }: ViolationCardProps) {
  return (
    <Card className={`border ${SEVERITY_BG[violation.severity]}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={SEVERITY_COLORS[violation.severity] as 'destructive' | 'outline' | 'secondary'}>
              {violation.severity}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">{violation.rule_reference}</span>
          </div>
          <span className="text-xs text-muted-foreground bg-white border rounded px-2 py-0.5">
            {violation.module.replace(/_/g, ' ')}
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Offending Element</p>
          <p className="text-sm italic border-l-2 border-muted-foreground/30 pl-2">
            &ldquo;{violation.offending_element}&rdquo;
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why It Violates</p>
          <p className="text-sm">{violation.why_its_a_violation}</p>
        </div>

        <div className="relative">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Fix Suggestion</p>
          {blurFix ? (
            <div className="relative">
              <p className="text-sm blur-sm select-none">{violation.fix_suggestion}</p>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white/90 border rounded px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                  Unlock full report
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm">{violation.fix_suggestion}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
