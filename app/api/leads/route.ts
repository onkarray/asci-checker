import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company, role, metadata } = body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    if (name && name.length > 100) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        email,
        name: name || null,
        company: company || null,
        role: role || null,
        ad_category: metadata?.ad_category || null,
        ad_format: metadata?.ad_format || null,
        platform: metadata?.platform || null,
        overall_score: metadata?.overall_score ?? null,
        verdict: metadata?.verdict || null,
        auto_fail: metadata?.auto_fail ?? false,
        escalation_req: metadata?.escalation_required ?? false,
        violation_mods: metadata?.violation_modules || [],
        high_count: metadata?.high_severity_count ?? 0,
        medium_count: metadata?.medium_severity_count ?? 0,
        low_count: metadata?.low_severity_count ?? 0,
        top_violation: metadata?.top_violation_rule || null,
        provider_used: metadata?.provider_used || null,
        report_sent: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead_id: data.id });
  } catch (err) {
    console.error('Leads route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
