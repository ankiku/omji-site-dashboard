export default function ProgressBar({ percent = 0, height, color }) {
  return (
    <div className="progress-bar" style={height ? { height } : undefined}>
      <div
        className="progress-bar-fill"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          ...(color ? { background: color } : {}),
        }}
      />
    </div>
  );
}
