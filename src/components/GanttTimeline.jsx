import { formatDate } from '../utils/helpers';

/**
 * A simplified Gantt timeline component using pure SVG — no external dependencies.
 */
export default function GanttTimeline({ tasks, phases }) {
  if (!tasks || tasks.length === 0) {
    return <div className="empty-state"><p>No tasks to visualize.</p></div>;
  }

  // Determine the global date range
  const allDates = [];
  tasks.forEach(t => {
    if (t.plannedStart) allDates.push(new Date(t.plannedStart));
    if (t.plannedFinish) allDates.push(new Date(t.plannedFinish));
    if (t.actualStart) allDates.push(new Date(t.actualStart));
    if (t.actualFinish) allDates.push(new Date(t.actualFinish));
  });

  if (allDates.length === 0) {
    return <div className="empty-state"><p>No date data available for timeline.</p></div>;
  }

  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  // Add padding of 7 days on each side
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 7);

  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  const dayWidth = 8;
  const rowHeight = 32;
  const labelWidth = 220;
  const headerHeight = 50;
  const chartWidth = labelWidth + totalDays * dayWidth + 40;

  const getDayOffset = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return Math.round((d - minDate) / (1000 * 60 * 60 * 24));
  };

  // Generate month labels
  const months = [];
  const cursor = new Date(minDate);
  cursor.setDate(1);
  while (cursor <= maxDate) {
    const dayOff = getDayOffset(cursor);
    if (dayOff !== null && dayOff >= 0) {
      months.push({
        label: cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        x: labelWidth + dayOff * dayWidth
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Today marker
  const today = new Date();
  const todayOffset = getDayOffset(today);
  const showToday = todayOffset !== null && todayOffset >= 0 && todayOffset <= totalDays;

  let currentRow = 0;
  const rows = [];

  phases.forEach(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    if (phaseTasks.length === 0) return;

    // Phase header row
    rows.push({ type: 'phase', label: phase, row: currentRow });
    currentRow++;

    phaseTasks.forEach(t => {
      const plannedStart = getDayOffset(t.plannedStart);
      const plannedFinish = getDayOffset(t.plannedFinish);
      const actualStart = getDayOffset(t.actualStart);
      const actualFinish = getDayOffset(t.actualFinish || (t.status === 'In Progress' ? today : null));

      const statusColor =
        t.status === 'Completed' ? '#4D6645' :
          t.status === 'Delayed' ? '#C4441E' :
            t.status === 'In Progress' ? '#B8862E' : '#BCAB8F';

      rows.push({
        type: 'task',
        task: t,
        row: currentRow,
        plannedStart,
        plannedFinish,
        actualStart,
        actualFinish,
        statusColor
      });
      currentRow++;
    });
  });

  const totalHeight = headerHeight + currentRow * rowHeight + 20;

  return (
    <div className="gantt-container">
      <div className="gantt-scroll">
        <svg width={chartWidth} height={totalHeight} className="gantt-svg">
          {/* Month headers */}
          {months.map((m, i) => (
            <g key={i}>
              <line x1={m.x} y1={0} x2={m.x} y2={totalHeight} stroke="#E5DFD3" strokeWidth="1" strokeDasharray="4,4" />
              <text x={m.x + 4} y={16} fontSize="0.65rem" fontFamily="'JetBrains Mono', monospace" fill="#7C7468" fontWeight="600">
                {m.label}
              </text>
            </g>
          ))}

          {/* Today line */}
          {showToday && (
            <g>
              <line
                x1={labelWidth + todayOffset * dayWidth}
                y1={headerHeight - 10}
                x2={labelWidth + todayOffset * dayWidth}
                y2={totalHeight}
                stroke="#C4441E"
                strokeWidth="2"
                strokeDasharray="6,3"
              />
              <text
                x={labelWidth + todayOffset * dayWidth}
                y={headerHeight - 14}
                fontSize="0.6rem"
                fontFamily="'JetBrains Mono', monospace"
                fill="#C4441E"
                fontWeight="700"
                textAnchor="middle"
              >
                TODAY
              </text>
            </g>
          )}

          {/* Rows */}
          {rows.map((r, i) => {
            const y = headerHeight + r.row * rowHeight;

            if (r.type === 'phase') {
              return (
                <g key={i}>
                  <rect x={0} y={y} width={chartWidth} height={rowHeight} fill="#FAF9F6" />
                  <text x={12} y={y + rowHeight / 2 + 4} fontSize="0.78rem" fontWeight="700" fontFamily="'Outfit', sans-serif" fill="#1C1A17">
                    {r.label}
                  </text>
                  <line x1={0} y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke="#E5DFD3" strokeWidth="1" />
                </g>
              );
            }

            const t = r.task;
            const barY = y + 8;
            const barH = rowHeight - 16;

            return (
              <g key={i}>
                {/* Row background */}
                <rect x={0} y={y} width={chartWidth} height={rowHeight} fill={i % 2 === 0 ? '#FFFFFF' : '#FDFCFA'} />
                <line x1={0} y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke="#F0ECE4" strokeWidth="0.5" />

                {/* Task label */}
                <text x={12} y={y + rowHeight / 2 + 4} fontSize="0.72rem" fontFamily="'Plus Jakarta Sans', sans-serif" fill="#2D2A25" fontWeight="500">
                  <tspan fontFamily="'JetBrains Mono', monospace" fontSize="0.68rem" fill="#7C7468">{t.taskNo} </tspan>
                  {t.activity?.substring(0, 26)}{t.activity?.length > 26 ? '…' : ''}
                </text>

                {/* Planned bar (lighter) */}
                {r.plannedStart !== null && r.plannedFinish !== null && (
                  <rect
                    x={labelWidth + r.plannedStart * dayWidth}
                    y={barY}
                    width={Math.max((r.plannedFinish - r.plannedStart) * dayWidth, dayWidth)}
                    height={barH}
                    rx={4}
                    fill={r.statusColor}
                    opacity="0.15"
                  />
                )}

                {/* Actual bar (solid) */}
                {r.actualStart !== null && r.actualFinish !== null && (
                  <rect
                    x={labelWidth + r.actualStart * dayWidth}
                    y={barY + 3}
                    width={Math.max((r.actualFinish - r.actualStart) * dayWidth, dayWidth)}
                    height={barH - 6}
                    rx={3}
                    fill={r.statusColor}
                    opacity="0.85"
                  />
                )}

                {/* Status dot */}
                <circle
                  cx={labelWidth + ((r.plannedStart || 0) * dayWidth) - 8}
                  cy={y + rowHeight / 2}
                  r={3}
                  fill={r.statusColor}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="gantt-legend">
        <span className="gantt-legend-item">
          <span style={{ background: '#4D6645', width: 12, height: 4, borderRadius: 2, display: 'inline-block' }} /> Completed
        </span>
        <span className="gantt-legend-item">
          <span style={{ background: '#B8862E', width: 12, height: 4, borderRadius: 2, display: 'inline-block' }} /> In Progress
        </span>
        <span className="gantt-legend-item">
          <span style={{ background: '#C4441E', width: 12, height: 4, borderRadius: 2, display: 'inline-block' }} /> Delayed
        </span>
        <span className="gantt-legend-item">
          <span style={{ background: '#BCAB8F', width: 12, height: 4, borderRadius: 2, display: 'inline-block' }} /> Planned
        </span>
      </div>
    </div>
  );
}
