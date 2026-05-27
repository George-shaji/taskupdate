const STATUS_ORDER = ['Pending', 'In Progress', 'Blocked', 'Completed'];

export default function ProjectDashboard({ tasks }) {
  const projects = Object.values((tasks || []).reduce((acc, task) => {
    const name = task.projectName || 'Unassigned';
    if (!acc[name]) {
      acc[name] = {
        name,
        total: 0,
        hours: 0,
        completed: 0,
        blocked: 0,
        high: 0,
        statuses: STATUS_ORDER.reduce((map, status) => ({ ...map, [status]: 0 }), {})
      };
    }

    const project = acc[name];
    const status = task.status || 'Pending';
    project.total += 1;
    project.hours += parseFloat(task.timeTaken) || 0;
    project.completed += status === 'Completed' ? 1 : 0;
    project.blocked += status === 'Blocked' ? 1 : 0;
    project.high += task.importLevel === 'High' ? 1 : 0;
    project.statuses[status] = (project.statuses[status] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b.total - a.total);

  if (!projects.length) return null;

  return (
    <section className="project-dashboard">
      <div className="section-title-row">
        <div>
          <span className="section-eyebrow">Project Dashboard</span>
          <h3>Project health</h3>
        </div>
      </div>

      <div className="project-dashboard-grid">
        {projects.slice(0, 6).map(project => {
          const completion = project.total ? Math.round((project.completed / project.total) * 100) : 0;

          return (
            <article className="project-health-card" key={project.name}>
              <header>
                <h4>{project.name}</h4>
                <span>{completion}% complete</span>
              </header>

              <div className="project-progress-track">
                <div style={{ width: `${completion}%` }}></div>
              </div>

              <div className="project-health-metrics">
                <span>{project.total} tasks</span>
                <span>{project.hours.toFixed(1)} hrs</span>
                <span>{project.high} high</span>
                <span>{project.blocked} blocked</span>
              </div>

              <div className="project-status-strip">
                {STATUS_ORDER.map(status => (
                  <span key={status} title={`${status}: ${project.statuses[status] || 0}`}>
                    {project.statuses[status] || 0}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
