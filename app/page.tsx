import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-slate-900 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-block bg-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full border border-amber-500/30 mb-2">
            ASCI 2024-25 Annual Report: 98% of ads reviewed required modification
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Is your ad ASCI compliant?
          </h1>
          <p className="text-lg text-slate-300 max-w-xl mx-auto">
            Check your ad against India&apos;s advertising rulebook before it gets flagged.
            Free. Takes 60 seconds.
          </p>
          <Link
            href="/check"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 py-4 rounded-xl text-lg transition-colors"
          >
            Check My Ad &rarr;
          </Link>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Your ad stays on your device &mdash; we never store your creative
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Backed by ASCI&apos;s official code + 2 years of complaints data
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Works with Claude, GPT-4o, or Gemini &mdash; use your own API key
            </span>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="bg-amber-50 border-y border-amber-200 py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { stat: '98%', label: 'of ads reviewed by ASCI in 2024-25 required modification' },
            { stat: '76%', label: "of India's top 100 digital creators violated ASCI guidelines" },
            { stat: '100%', label: 'of green claim ads failed ASCI scrutiny last year' },
          ].map(({ stat, label }) => (
            <div key={stat} className="space-y-1">
              <div className="text-3xl font-bold text-slate-900">{stat}</div>
              <p className="text-sm text-slate-600">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Upload your ad',
                desc: 'Text, image, carousel, or video. Your file never leaves your device.',
              },
              {
                step: '2',
                title: 'Get your compliance score',
                desc: 'Powered by Claude, GPT-4o, or Gemini — using your own API key. Takes ~60 seconds.',
              },
              {
                step: '3',
                title: 'Download your fix report',
                desc: 'Every violation flagged with the exact rule, what to fix, and how.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold mx-auto">
                  {step}
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/check"
              className="inline-block bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors"
            >
              Check My Ad &mdash; Free
            </Link>
          </div>
        </div>
      </section>

      {/* Privacy note */}
      <section className="py-10 px-4 bg-slate-50 border-t">
        <div className="max-w-2xl mx-auto text-center space-y-2 text-sm text-muted-foreground">
          <p>
            Your ad is analyzed entirely in your browser using your own API key.
            We never receive or store your ad content.
          </p>
          <p>
            This tool applies ASCI&apos;s publicly available Code for Self-Regulation and is not affiliated with or endorsed by ASCI.
          </p>
          <p>
            A compliance score from this tool does not guarantee ASCI approval.
            For official pre-publication advice, use ASCI&apos;s Ad Advice Service.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t text-center text-xs text-muted-foreground">
        This tool is not affiliated with ASCI. It applies ASCI&apos;s publicly available code and guidelines to help advertisers self-review.
      </footer>
    </div>
  );
}
