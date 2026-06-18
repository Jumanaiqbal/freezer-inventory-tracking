import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function UpdateStock() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [workerName, setWorkerName] = useState("");
  const [customerType, setCustomerType] = useState("shop");
  const [companyName, setCompanyName] = useState("");
  const [saleLines, setSaleLines] = useState([
    { category: "", subtype: "", quantity: "" },
  ]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('category').order('subtype');
    if (error) {
      setMessage({ text: `Error loading items: ${error.message}`, type: 'error' });
      return;
    }
    if (data) {
      setItems(data);
      setCategories([...new Set(data.map(item => item.category))].sort());
    }
  };

  const getSubtypesForCategory = (category) =>
    items
      .filter((item) => item.category === category)
      .map((item) => item.subtype)
      .sort();

  const updateSaleLine = (index, key, value) => {
    setSaleLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (key === "category") {
          return { ...line, category: value, subtype: "" };
        }
        return { ...line, [key]: value };
      })
    );
  };

  const addSaleLine = () => {
    setSaleLines((prev) => [...prev, { category: "", subtype: "", quantity: "" }]);
  };

  const removeSaleLine = (index) => {
    setSaleLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!workerName.trim()) {
      setMessage({ text: "Please enter worker name", type: "error" });
      setLoading(false);
      return;
    }

    if (customerType === "company" && !companyName.trim()) {
      setMessage({ text: "Please enter company name for company sale", type: "error" });
      setLoading(false);
      return;
    }

    const normalizedLines = saleLines
      .map((line) => ({
        category: line.category,
        subtype: line.subtype,
        quantity: parseInt(line.quantity, 10),
      }))
      .filter((line) => line.category && line.subtype && Number.isInteger(line.quantity) && line.quantity > 0);

    if (normalizedLines.length === 0) {
      setMessage({ text: "Add at least one valid sales item", type: "error" });
      setLoading(false);
      return;
    }

    try {
      const lines = normalizedLines.map((line) => ({
        category: line.category,
        subtype: line.subtype,
        quantity: line.quantity,
      }));

      const { data, error } = await supabase.rpc("process_sale", {
        p_lines: lines,
        p_worker_name: workerName.trim(),
        p_customer_type: customerType,
        p_company_name: customerType === "company" ? companyName.trim() : null,
      });

      if (error) throw error;

      setMessage({
        text: `Success! Processed ${data?.processed ?? lines.length} sales item(s)`,
        type: "success",
      });
      setSaleLines([{ category: "", subtype: "", quantity: "" }]);
      setCompanyName("");
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      fetchItems();
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="update-stock">
      <h2>Sales</h2>
      <form onSubmit={handleUpdate}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Worker Name
          </label>
          <input
            type="text"
            placeholder="Your name"
            value={workerName}
            onChange={e => setWorkerName(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Customer Type
          </label>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
          >
            <option value="shop">Shop Customer</option>
            <option value="company">Company (Bulk)</option>
          </select>
        </div>

        {customerType === "company" && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
              Company Name
            </label>
            <input
              type="text"
              placeholder="Enter company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
        )}

        <div className="sales-items-panel">
          <h3 className="sales-items-title">Sale Items</h3>
          {saleLines.map((line, index) => (
            <div key={index} className="sales-line-row">
              <select
                value={line.category}
                onChange={(e) => updateSaleLine(index, "category", e.target.value)}
                required
                className="sales-line-field"
              >
                <option value="">Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={line.subtype}
                onChange={(e) => updateSaleLine(index, "subtype", e.target.value)}
                required
                disabled={!line.category}
                className="sales-line-field"
              >
                <option value="">Subtype</option>
                {getSubtypesForCategory(line.category).map((subtype) => (
                  <option key={subtype} value={subtype}>{subtype}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateSaleLine(index, "quantity", e.target.value)}
                required
                className="sales-line-field sales-qty-field"
              />
              <button
                type="button"
                onClick={() => removeSaleLine(index)}
                disabled={saleLines.length === 1}
                className="sales-remove-btn"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addSaleLine} className="sales-add-btn">
            + Add another product
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Remove from Stock (All Items)"}
        </button>
      </form>
      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}