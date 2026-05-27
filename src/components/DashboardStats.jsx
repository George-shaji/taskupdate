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

  const completedTasks = tasks.filter(task => (task.status || 'Pending') === 'Completed').length;
  const blockedTasks = tasks.filter(task => (task.status || 'Pending') === 'Blocked').length;
  const overdueTasks = tasks.filter(task => {
    if (!task.dueDate || task.status === 'Completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.dueDate) < today;
  }).length;

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

      <div className="glass-card metric-card">
        <h4>Completed</h4>
        <div className="metric-val emerald">{completedTasks}</div>
      </div>

      <div className="glass-card metric-card">
        <h4>Blocked</h4>
        <div className="metric-val amber">{blockedTasks}</div>
      </div>

      <div className="glass-card metric-card">
        <h4>Overdue</h4>
        <div className="metric-val crimson">{overdueTasks}</div>
      </div>
    </div>
  );
}
