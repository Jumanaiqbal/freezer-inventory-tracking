import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

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

    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("items")
            .select("*")
            .order("category", { ascending: true })
            .order("subtype", { ascending: true })
        );

        if (error) throw error;
        setItems(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []); // Empty dependency array - run once on mount

  const isLowStockItem = (quantity) => (Number(quantity) || 0) < 1000;

  // Filter items based on search and low stock toggle
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.subtype || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (!showLowStockOnly) return true;
    return isLowStockItem(item.quantity);
  });

  // Group filtered items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Calculate stats
  const stats = {
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    totalTypes: items.length,
    lowStock: items.filter(item => isLowStockItem(item.quantity)).length,
  };

  const getStockStatus = (quantity) => {
    const safeQuantity = Number(quantity) || 0;
    if (safeQuantity < 1000) return { class: 'critical-stock', label: 'Critical' };
    if (safeQuantity < 5000) return { class: 'medium-stock', label: 'Medium' };
    return { class: 'healthy-stock', label: 'Healthy' };
  };

  if (loading) return <div className="loading">Loading inventory</div>;
  if (error) return <div className="message error">Error: {error}</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Live Inventory Dashboard</h2>
        <input
          type="text"
          placeholder="Search items..."
          className="search-box"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{stats.totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Item Types</div>
          <div className="stat-value">{stats.totalTypes}</div>
        </div>
        <div
          className="stat-card warning"
          onClick={() => setShowLowStockOnly((prev) => !prev)}
          style={{
            cursor: "pointer",
            border: showLowStockOnly ? "2px solid #f59e0b" : undefined,
          }}
          title="Click to filter low-stock items"
        >
          <div className="stat-label">Low Stock</div>
          <div className="stat-value">{stats.lowStock}</div>
        </div>
      </div>

      {showLowStockOnly && (
        <div className="message" style={{ marginBottom: "1rem" }}>
          Showing only low-stock items. Click "Low Stock" card again to clear filter.
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="category-section">
          <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
            {searchTerm ? 'No items match your search.' : 'No items in inventory.'}
          </p>
        </div>
      ) : (
        Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="category-section">
            <div className="category-header">
              <h3>{category}</h3>
              <span className="category-count">{categoryItems.length} subtypes</span>
            </div>
            <div className="items-grid">
              {categoryItems.map(item => {
                const status = getStockStatus(item.quantity);
                return (
                  <div key={item.id} className={`item-card ${status.class}`}>
                    <h4>{item.subtype}</h4>
                    <p className="quantity">{item.quantity}</p>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>pieces in stock</div>
                    <span className={`stock-badge ${status.class.replace('-stock', '')}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}