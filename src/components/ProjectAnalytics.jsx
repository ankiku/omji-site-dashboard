import { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProjectAnalytics({ projects, projectStats }) {
  const data = useMemo(() => {
    let active = 0;
    let completed = 0;
    let delayed = 0;

    const progressData = [];

    projects.forEach(p => {
      const stats = projectStats[p.id] || { percentComplete: 0, delayed: 0 };

      if (stats.percentComplete === 100) {
        completed++;
      } else {
        active++;
        if (stats.delayed > 0) delayed++;
      }

      if (stats.percentComplete < 100) {
        progressData.push({
          name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
          progress: stats.percentComplete,
          delayed: stats.delayed
        });
      }
    });

    const statusData = [
      { name: 'Active', value: active, color: '#B8862E' }, // Gold
      { name: 'Completed', value: completed, color: '#4D6645' }, // Green
      { name: 'Delayed', value: delayed, color: '#C4441E' } // Rust
    ].filter(d => d.value > 0);

    return {
      total: projects.length,
      active,
      completed,
      delayed,
      statusData,
      progressData: progressData.sort((a, b) => b.progress - a.progress).slice(0, 5) // Top 5
    };
  }, [projects, projectStats]);

  if (projects.length === 0) return null;

  return (
    <div className="project-analytics-dashboard">
      <div className="analytics-summary-cards">
        <div className="analytics-card">
          <div className="analytics-card-title">Total Projects</div>
          <div className="analytics-card-value">{data.total}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-title">Active Projects</div>
          <div className="analytics-card-value">{data.active}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-title">Completed</div>
          <div className="analytics-card-value">{data.completed}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-title">Flagged / Delayed</div>
          <div className="analytics-card-value warning">{data.delayed}</div>
        </div>
      </div>

    </div>
  );
}
