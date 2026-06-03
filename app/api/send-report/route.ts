import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { AnalysisResult } from '@/components/analysis/AnalysisRunner';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailHtml(name: string, analysis: AnalysisResult): string {
  const verdictColor =
    analysis.verdict === 'COMPLIANT' ? '#16a34a'
    : analysis.verdict === 'NEEDS_REVISION' ? '#d97706'
    : '#dc2626';

  const violations = analysis.violations ?? [];
  const compliantElements = analysis.compliant_elements ?? [];

  const severityColor = (s: string) =>
    s === 'HIGH' ? '#dc2626' : s === 'MEDIUM' ? '#d97706' : '#6b7280';
  const severityBg = (s: string) =>
    s === 'HIGH' ? '#fef2f2' : s === 'MEDIUM' ? '#fffbeb' : '#f9fafb';
  const severityBorder = (s: string) =>
    s === 'HIGH' ? '#fecaca' : s === 'MEDIUM' ? '#fde68a' : '#e5e7eb';

  const violationCards = violations.map((v) => `
    <div style="margin-bottom:16px;border:1px solid ${severityBorder(v.severity)};border-left:4px solid ${severityColor(v.severity)};border-radius:6px;background:${severityBg(v.severity)};padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="background:${severityColor(v.severity)};color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">${v.severity}</span>
        <span style="font-weight:600;font-size:13px;color:#1e293b;">${v.rule_reference}</span>
        <span style="font-size:11px;color:#6b7280;margin-left:auto;">${(v.module || '').replace(/_/g, ' ')}</span>
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Offending Element</div>
        <div style="font-style:italic;font-size:13px;color:#374151;background:#fff;border-radius:4px;padding:8px;border:1px solid ${severityBorder(v.severity)};">"${v.offending_element || ''}"</div>
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Why It Violates</div>
        <div style="font-size:13px;color:#374151;">${v.why_its_a_violation || ''}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Fix Suggestion</div>
        <div style="font-size:13px;color:#374151;">${v.fix_suggestion || ''}</div>
      </div>
    </div>
  `).join('');

  const categoryRows = [
    { label: 'Claim Substantiation', key: 'claim_substantiation', max: 25 },
    { label: 'Disclosure Compliance', key: 'disclosure_compliance', max: 25 },
    { label: 'Prohibited Category', key: 'prohibited_category_check', max: 20 },
    { label: 'Sector-Specific Rules', key: 'sector_specific', max: 20 },
    { label: 'Language & Framing', key: 'language_and_framing', max: 10 },
  ].map(c => {
    const score = (analysis.category_scores as Record<string, number>)[c.key] ?? 0;
    const pct = Math.round((score / c.max) * 100);
    const barColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
    return `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#374151;">${c.label}</td>
        <td style="padding:6px 0;text-align:right;font-size:13px;color:#6b7280;">${score}/${c.max}</td>
        <td style="padding:6px 8px;width:120px;">
          <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
            <div style="background:${barColor};height:8px;width:${pct}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const compliantItems = compliantElements
    .map(el => `<li style="margin-bottom:6px;font-size:13px;color:#374151;">${el}</li>`).join('');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://asci-checker.vercel.app';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#1e293b;background:#f8fafc;">

  <div style="background:#1e293b;padding:24px 28px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">ASCI Ad Compliance Report</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Hi ${name} — here is your full compliance analysis.</p>
  </div>

  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:28px;">

    <!-- Score -->
    <div style="text-align:center;padding:24px 0 16px;">
      <div style="font-size:52px;font-weight:800;color:${verdictColor};line-height:1;">
        ${analysis.verdict === 'AUTO_FAIL' ? 'AUTO-FAIL' : `${analysis.overall_score}/100`}
      </div>
      <div style="font-size:15px;font-weight:700;color:${verdictColor};margin-top:6px;letter-spacing:0.05em;">
        ${analysis.verdict.replace(/_/g, ' ')}
      </div>
      ${analysis.auto_fail_reason ? `<div style="margin-top:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;font-size:13px;color:#dc2626;">${analysis.auto_fail_reason}</div>` : ''}
    </div>

    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">${analysis.full_summary || ''}</p>

    <!-- Category Breakdown -->
    <h2 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Category Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${categoryRows}</table>

    ${violations.length > 0 ? `
    <!-- Violations -->
    <h2 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
      Violations (${violations.length})
    </h2>
    ${violationCards}
    ` : ''}

    ${compliantElements.length > 0 ? `
    <!-- What you got right -->
    <h2 style="font-size:14px;font-weight:700;color:#16a34a;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid #dcfce7;">What Your Ad Got Right</h2>
    <ul style="padding-left:18px;margin:0 0 24px;">${compliantItems}</ul>
    ` : ''}

    <div style="text-align:center;margin:24px 0 16px;">
      <a href="${appUrl}/check" style="background:#1e293b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
        Check Another Ad →
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
    <p style="font-size:11px;color:#94a3b8;line-height:1.5;">
      This report applies ASCI's publicly available Code for Self-Regulation and is not affiliated with or endorsed by ASCI.
      A compliance score from this tool does not guarantee ASCI approval.<br><br>
      To unsubscribe, reply with "unsubscribe".
    </p>
  </div>

</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, analysis } = body as {
      email: string;
      name: string;
      analysis: AnalysisResult;
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || !analysis) {
      return NextResponse.json({ error: 'Valid email and analysis required' }, { status: 400 });
    }

    const subject = `Your ASCI Compliance Report — ${
      analysis.verdict === 'AUTO_FAIL' ? 'AUTO-FAIL' : `${analysis.overall_score}/100`
    }`;

    const { error } = await resend.emails.send({
      from: 'ASCI Checker <reports@outoftheblue.ai>',
      to: email,
      subject,
      html: buildEmailHtml(name || 'there', analysis),
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Send report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
