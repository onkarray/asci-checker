'use client';

import { useState, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnalysisResult } from '@/components/analysis/AnalysisRunner';
import { Provider } from '@/components/analysis/ProviderRouter';

interface EmailGateProps {
  result: AnalysisResult;
  adCategory: string;
  adFormat: string;
  platform: string;
  provider: Provider;
  onUnlocked: (email: string, name: string) => void;
}

const ROLES = [
  'Brand Manager',
  'Agency',
  'Creator/Influencer',
  'Founder',
  'Marketing Lead',
  'Other',
];

const EmailGate = forwardRef<HTMLDivElement, EmailGateProps>(
  ({ result, adCategory, adFormat, platform, provider, onUnlocked }, ref) => {
    const [firstName, setFirstName] = useState('');
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!firstName.trim() || !email.trim()) return;
      setLoading(true);
      setError('');

      const highCount = result.violations.filter(v => v.severity === 'HIGH').length;
      const mediumCount = result.violations.filter(v => v.severity === 'MEDIUM').length;
      const lowCount = result.violations.filter(v => v.severity === 'LOW').length;
      const topHighViolation = result.violations.find(v => v.severity === 'HIGH');
      const topMediumViolation = result.violations.find(v => v.severity === 'MEDIUM');
      const topViolationRule = topHighViolation?.rule_reference || topMediumViolation?.rule_reference || null;
      const violationModules = result.violations.map(v => v.module).filter((m, i, arr) => arr.indexOf(m) === i);

      try {
        // Leads insert is best-effort — don't block the user if it fails
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: firstName,
            company: company || null,
            role: role || null,
            metadata: {
              ad_category: adCategory,
              ad_format: adFormat,
              platform,
              overall_score: result.overall_score,
              verdict: result.verdict,
              auto_fail: result.verdict === 'AUTO_FAIL',
              escalation_required: result.escalation_required,
              violation_modules: violationModules,
              high_severity_count: highCount,
              medium_severity_count: mediumCount,
              low_severity_count: lowCount,
              top_violation_rule: topViolationRule,
              provider_used: provider,
            },
          }),
        }).catch(() => {}); // silently ignore

        const reportRes = await fetch('/api/send-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: firstName, analysis: result }),
        });

        if (!reportRes.ok) {
          const d = await reportRes.json();
          throw new Error(d.error || 'Failed to send report');
        }

        setSent(true);
        onUnlocked(email, firstName);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div ref={ref} className="border rounded-xl p-6 bg-card space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Get your complete fix report — free</h2>
          <p className="text-muted-foreground text-sm">
            We&apos;ll email you the full report with every violation and fix suggestion, plus a downloadable PDF.
          </p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm font-medium">
            Report sent to {email} — check your inbox!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  placeholder="Priya"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="priya@brand.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company (optional)</Label>
                <Input
                  id="company"
                  placeholder="Acme Brands"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role (optional)</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !firstName.trim() || !email.trim()}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send me the full report'}
            </button>

            <p className="text-xs text-muted-foreground">
              We never store your ad. Only your score and violation summary are saved to send you relevant resources.
              No spam — unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    );
  }
);

EmailGate.displayName = 'EmailGate';
export default EmailGate;
