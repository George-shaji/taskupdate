export default function DashboardStats({ tasks }) {
  // Aggregate Metrics
  const totalTasks = tasks.length;
  
  const totalHours = tasks.reduce((sum, task) => {
    return sum + (parseFloat(task.timeTaken) || 0);
  }, 0).toFixed(2);

  const priorityCounts = tasks.reduce((acc, task) => {
    const p = (task.importLevel || 'Medium').toLowerCase();
    if (acc[p] !== undefined) {
      acc[p]++;
    }
    return acc;
  }, { high: 0, medium: 0, low: 0 });

  return (
    <div className="metrics-row">
      <div className="glass-card metric-card">
        <h4>Logged Updates</h4>
        <div className="metric-val purple">{totalTasks}</div>
      </div>

      <div className="glass-card metric-card">
        <h4>Total Investment</h4>
        <div className="metric-val">{totalHours} <span style={{ fontSize: '1rem', color: '#64748b' }}>hrs</span></div>
      </div>

      <div className="glass-card metric-card">
        <h4>High Alert</h4>
        <div className="metric-val crimson">{priorityCounts.high}</div>
      </div>

      <div className="glass-card metric-card">
        <h4>Medium Priority</h4>
        <div className="metric-val amber">{priorityCounts.medium}</div>
      </div>

      <div className="glass-card metric-card">
        <h4>Low Focus</h4>
        <div className="metric-val emerald">{priorityCounts.low}</div>
      </div>
    </div>
  );
}
