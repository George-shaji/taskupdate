const labels = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  send: 'Pushed',
  summary: 'Summary'
};

export default function ActivityLog({ activities }) {
  const recent = (activities || []).slice(0, 8);

  return (
    <section className="activity-panel glass-card">
      <div className="section-title-row">
        <div>
          <span className="section-eyebrow">Audit Trail</span>
          <h3>Recent activity</h3>
        </div>
      </div>

      {recent.length === 0 ? (
        <p className="activity-empty">No activity recorded yet.</p>
      ) : (
        <div className="activity-list">
          {recent.map(item => (
            <div className="activity-item" key={item.id}>
              <span className={`activity-dot ${item.type}`}></span>
              <div>
                <strong>{labels[item.type] || item.type}</strong>
                <p>{item.message}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
