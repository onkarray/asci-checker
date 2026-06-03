'use client';

interface ScoreGaugeProps {
  score: number;
  verdict: string;
  size?: 'sm' | 'lg';
}

function getColor(score: number, verdict: string) {
  if (verdict === 'AUTO_FAIL') return { stroke: '#ef4444', text: '#ef4444' };
  if (score >= 80) return { stroke: '#22c55e', text: '#16a34a' };
  if (score >= 60) return { stroke: '#f59e0b', text: '#d97706' };
  return { stroke: '#ef4444', text: '#ef4444' };
}

export default function ScoreGauge({ score, verdict, size = 'lg' }: ScoreGaugeProps) {
  const displayScore = verdict === 'AUTO_FAIL' ? 0 : score;
  const { stroke, text } = getColor(score, verdict);
  const dim = size === 'lg' ? 160 : 100;
  const cx = dim / 2;
  const cy = dim / 2;
  const r = dim * 0.38;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - displayScore / 100);
  const fontSize = size === 'lg' ? 32 : 20;
  const subFontSize = size === 'lg' ? 12 : 9;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={size === 'lg' ? 14 : 10}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={size === 'lg' ? 14 : 10}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="bold"
          fill={text}
        >
          {verdict === 'AUTO_FAIL' ? '!' : displayScore}
        </text>
        <text
          x={cx}
          y={cy + fontSize * 0.7}
          textAnchor="middle"
          fontSize={subFontSize}
          fill="#6b7280"
        >
          {verdict === 'AUTO_FAIL' ? 'AUTO-FAIL' : '/100'}
        </text>
      </svg>
    </div>
  );
}
