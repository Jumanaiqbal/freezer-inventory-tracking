import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterWorker, setFilterWorker] = useState("");
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    fetchLogs();
    fetchWorkers();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('history-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'history' },
        () => fetchLogs()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('history')
        .select(`
          id,
          item_id,
          action,
          quantity_changed,
          worker_name,
          created_at,
          items (
            category,
            subtype
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('history')
        .select('worker_name');

      if (error) throw error;
      // Get unique workers (case-insensitive) - keep alphabetically first occurrence's casing
      const workerMap = new Map();
      data?.forEach(d => {
        const lowerName = d.worker_name.toLowerCase();
        if (!workerMap.has(lowerName)) {
          workerMap.set(lowerName, d.worker_name);
        }
      });
      // Sort by lowercase name but keep original casing
      const uniqueWorkers = Array.from(workerMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(entry => entry[1]);
      setWorkers(uniqueWorkers);
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  // Filter logs by worker (case-insensitive)
  const filteredLogs = filterWorker
    ? logs.filter(log => log.worker_name.toLowerCase() === filterWorker.toLowerCase())
    : logs;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) return <div className="loading">Loading activity logs</div>;
  if (error) return <div className="message error">Error: {error}</div>;

  return (
    <div className="history">
      <div className="dashboard-header">
        <h2>Activity Logs</h2>
        <div>
          <label style={{ marginRight: '0.5rem', fontWeight: '500' }}>Filter by Worker:</label>
          <select
            value={filterWorker}
            onChange={e => setFilterWorker(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #e5e7eb',
              fontSize: '0.875rem'
            }}
          >
            <option value="">All Workers</option>
            {workers.map(worker => (
              <option key={worker} value={worker}>{worker}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date & Time</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Worker</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Category</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Subtype</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Action</th>
              <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  {filterWorker ? `No logs found for ${filterWorker}` : 'No activity logs yet'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, index) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9fafb'}
                >
                  <td style={{ padding: '1rem', color: '#4b5563', fontSize: '0.875rem' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td style={{ padding: '1rem', color: '#374151', fontWeight: '500' }}>
                    {log.worker_name}
                  </td>
                  <td style={{ padding: '1rem', color: '#4b5563' }}>
                    {log.items?.category || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem', color: '#4b5563' }}>
                    {log.items?.subtype || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        backgroundColor: log.action === 'add' ? '#d1fae5' : '#fee2e2',
                        color: log.action === 'add' ? '#065f46' : '#991b1b'
                      }}
                    >
                      {log.action === 'add' ? 'Added' : 'Removed'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#2563eb' }}>
                    {log.quantity_changed} pcs
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
        Total entries: <strong>{filteredLogs.length}</strong>
      </div>
    </div>
  );
}
