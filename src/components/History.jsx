import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const PAGE_SIZE = 10;

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterWorker, setFilterWorker] = useState("");
  const [workers, setWorkers] = useState([]);
  const [expandedSales, setExpandedSales] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  const parseWorkerContext = (rawWorkerName) => {
    const parts = (rawWorkerName || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    const worker = parts[0] || "Unknown";
    const saleRef = parts.find((part) => part.startsWith("SALE-")) || null;
    const companyPart = parts.find((part) => part.startsWith("company:")) || null;
    const customerLabel = companyPart
      ? companyPart.replace("company:", "Company: ")
      : parts.includes("shop")
        ? "Shop Customer"
        : "";

    return { worker, saleRef, customerLabel };
  };

  useEffect(() => {
    const withTimeout = (promise, ms = 15000) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Request timed out. Please refresh and try again.")),
            ms
          )
        ),
      ]);

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await withTimeout(
          supabase
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
            .order('created_at', { ascending: false })
        );

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
        const { data, error } = await withTimeout(
          supabase
            .from('history')
            .select('worker_name')
        );

        if (error) throw error;
        const workerMap = new Map();
        data?.forEach(d => {
          const parsed = parseWorkerContext(d.worker_name);
          const normalizedWorker = parsed.worker || "Unknown";
          const lowerName = normalizedWorker.toLowerCase();
          if (!workerMap.has(lowerName)) {
            workerMap.set(lowerName, normalizedWorker);
          }
        });
        const uniqueWorkers = Array.from(workerMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(entry => entry[1]);
        setWorkers(uniqueWorkers);
      } catch (err) {
        console.error('Error fetching workers:', err);
      }
    };

    fetchLogs();
    fetchWorkers();
  }, []); // Empty dependency array - run once on mount

  useEffect(() => {
    setCurrentPage(1);
  }, [filterWorker]);

  // Filter logs by worker (case-insensitive)
  const filteredLogs = filterWorker
    ? logs.filter(log => parseWorkerContext(log.worker_name).worker.toLowerCase() === filterWorker.toLowerCase())
    : logs;

  // Group sales entries by SALE reference to avoid log spam for multi-item sales.
  const groupedLogs = useMemo(() => {
    const rows = [];
    const saleGroups = new Map();
    filteredLogs.forEach((log) => {
      const parsed = parseWorkerContext(log.worker_name);
      if (!parsed.saleRef) {
        rows.push({
          type: "single",
          id: `single-${log.id}`,
          created_at: log.created_at,
          worker: parsed.worker,
          customerLabel: parsed.customerLabel,
          category: log.items?.category || "N/A",
          subtype: log.items?.subtype || "N/A",
          action: log.action,
          quantity_changed: log.quantity_changed,
        });
        return;
      }

      if (!saleGroups.has(parsed.saleRef)) {
        saleGroups.set(parsed.saleRef, {
          type: "group",
          id: `group-${parsed.saleRef}`,
          saleRef: parsed.saleRef,
          created_at: log.created_at,
          worker: parsed.worker,
          customerLabel: parsed.customerLabel,
          action: log.action,
          lineCount: 0,
          totalQuantity: 0,
          lines: [],
        });
      }

      const group = saleGroups.get(parsed.saleRef);
      group.lineCount += 1;
      group.totalQuantity += Number(log.quantity_changed) || 0;
      group.lines.push({
        id: log.id,
        category: log.items?.category || "N/A",
        subtype: log.items?.subtype || "N/A",
        quantity: log.quantity_changed,
      });
      if (new Date(log.created_at) > new Date(group.created_at)) {
        group.created_at = log.created_at;
      }
    });

    const groupedSales = Array.from(saleGroups.values()).map((sale) => ({
      ...sale,
      lines: sale.lines.sort((a, b) =>
        `${a.category}-${a.subtype}`.localeCompare(`${b.category}-${b.subtype}`)
      ),
    }));

    rows.push(...groupedSales);
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows;
  }, [filteredLogs]);

  const totalGrouped = groupedLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalGrouped / PAGE_SIZE));
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = totalGrouped === 0 ? 0 : (effectivePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(totalGrouped, effectivePage * PAGE_SIZE);
  const paginatedLogs = groupedLogs.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE
  );

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(totalGrouped / PAGE_SIZE));
    setCurrentPage((p) => Math.min(Math.max(1, p), tp));
  }, [totalGrouped]);

  const toggleSale = (saleRef) => {
    setExpandedSales((prev) => ({
      ...prev,
      [saleRef]: !prev[saleRef],
    }));
  };

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
            {totalGrouped === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  {filterWorker ? `No logs found for ${filterWorker}` : 'No activity logs yet'}
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log, index) => {
                const baseRowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                const isExpanded = log.type === "group" ? !!expandedSales[log.saleRef] : false;
                return (
                  <Fragment key={log.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: baseRowColor,
                        transition: 'background-color 0.2s',
                        cursor: log.type === "group" ? "pointer" : "default",
                      }}
                      onClick={() => log.type === "group" && toggleSale(log.saleRef)}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = baseRowColor}
                    >
                      <td style={{ padding: '1rem', color: '#4b5563', fontSize: '0.875rem' }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td style={{ padding: '1rem', color: '#374151', fontWeight: '500' }}>
                        {log.worker}
                      </td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}>
                        {log.type === "group" ? (log.customerLabel || "Grouped Sale") : log.category}
                      </td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}>
                        {log.type === "group"
                          ? `${isExpanded ? "▼" : "▶"} ${log.lineCount} item${log.lineCount > 1 ? "s" : ""}`
                          : log.subtype}
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
                        {log.type === "group" ? `${log.totalQuantity} pcs` : `${log.quantity_changed} pcs`}
                      </td>
                    </tr>

                    {log.type === "group" && isExpanded && (
                      <tr key={`${log.id}-details`} style={{ backgroundColor: '#f8fafc' }}>
                        <td colSpan="6" style={{ padding: '0.75rem 1rem 1rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                            Sale Items
                          </div>
                          <div style={{ display: 'grid', gap: '0.4rem' }}>
                            {log.lines.map((line) => (
                              <div
                                key={line.id}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr auto',
                                  gap: '0.75rem',
                                  padding: '0.5rem 0.75rem',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '0.5rem',
                                  backgroundColor: '#ffffff',
                                  color: '#4b5563',
                                  fontSize: '0.875rem',
                                }}
                              >
                                <span>{line.category}</span>
                                <span>{line.subtype}</span>
                                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{line.quantity} pcs</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalGrouped > 0 && (
        <div className="history-pagination">
          <button
            type="button"
            className="history-pagination-btn"
            disabled={effectivePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="history-pagination-meta">
            Page {effectivePage} of {totalPages}
            <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
              Showing {pageStart}–{pageEnd} of {totalGrouped}
            </span>
          </span>
          <button
            type="button"
            className="history-pagination-btn"
            disabled={effectivePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
        Total grouped entries: <strong>{totalGrouped}</strong>
        {' '}(10 per page)
      </div>
    </div>
  );
}
