import { computeProjectStats } from '../utils/helpers';

/**
 * A canvas-drawn donut chart component — no external dependencies.
 */
export default function DonutChart({ tasks, size = 200 }) {
  const stats = computeProjectStats(tasks);
  const segments = [
    { label: 'Completed', count: stats.completed, color: '#4D6645' },
    { label: 'In Progress', count: stats.inProgress, color: '#B8862E' },
    { label: 'Delayed', count: stats.delayed, color: '#C4441E' },
    { label: 'Not Started', count: stats.notStarted, color: '#BCAB8F' },
  ].filter(s => s.count > 0);

  const total = stats.total || 1;
  const center = size / 2;
  const radius = size / 2 - 12;
  const innerRadius = radius * 0.62;

  let currentAngle = -Math.PI / 2;

  const arcs = segments.map(seg => {
    const angle = (seg.count / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = startAngle + angle;
    currentAngle = endAngle;

    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const ix1 = center + innerRadius * Math.cos(startAngle);
    const iy1 = center + innerRadius * Math.sin(startAngle);
    const ix2 = center + innerRadius * Math.cos(endAngle);
    const iy2 = center + innerRadius * Math.sin(endAngle);

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z'
    ].join(' ');

    return { ...seg, d };
  });

  return (
    <div className="donut-chart-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
        {/* Background circle */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E5DFD3" strokeWidth="1" />
        <circle cx={center} cy={center} r={innerRadius} fill="none" stroke="#E5DFD3" strokeWidth="1" />

        {arcs.map((arc, i) => (
          <path key={i} d={arc.d} fill={arc.color} opacity="0.9" className="donut-segment">
            <title>{arc.label}: {arc.count} ({Math.round((arc.count / total) * 100)}%)</title>
          </path>
        ))}

        {/* Center text */}
        <text x={center} y={center - 8} textAnchor="middle" fontSize="1.7rem" fontWeight="700" fontFamily="'Outfit', sans-serif" fill="#1C1A17">
          {stats.percentComplete}%
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fontSize="0.6rem" fontWeight="600" fontFamily="'JetBrains Mono', monospace" fill="#7C7468" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          COMPLETE
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-count">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
