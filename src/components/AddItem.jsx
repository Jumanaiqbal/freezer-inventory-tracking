import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AddItem() {
  const [workerName, setWorkerName] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockLines, setStockLines] = useState([
    { category: "", subtype: "", quantity: "" },
  ]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase.from("items").select("*").order("category").order("subtype");
    if (error) {
      console.error("Error loading items:", error);
      return;
    }
    if (data) {
      setItems(data);
      setCategories([...new Set(data.map((item) => item.category))].sort());
    }
  };

  const getSubtypesForCategory = (category) =>
    items
      .filter((item) => item.category === category)
      .map((item) => item.subtype)
      .sort();

  const updateStockLine = (index, key, value) => {
    setStockLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (key === "category") return { ...line, category: value, subtype: "" };
        return { ...line, [key]: value };
      })
    );
  };

  const addStockLine = () => {
    setStockLines((prev) => [...prev, { category: "", subtype: "", quantity: "" }]);
  };

  const removeStockLine = (index) => {
    setStockLines((prev) => prev.filter((_, lineIndex) => lineIndex !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!workerName.trim()) {
      setMessage({ text: "Please enter your name", type: "error" });
      setLoading(false);
      return;
    }

    const normalizedLines = stockLines
      .map((line) => ({
        category: line.category.trim(),
        subtype: line.subtype.trim(),
        quantity: parseInt(line.quantity, 10),
      }))
      .filter(
        (line) =>
          line.category &&
          line.subtype &&
          Number.isInteger(line.quantity) &&
          line.quantity > 0
      );

    if (normalizedLines.length === 0) {
      setMessage({ text: "Add at least one product with a valid quantity", type: "error" });
      setLoading(false);
      return;
    }

    try {
      const { data: freshItems, error: loadError } = await supabase.from("items").select("id, category, subtype, quantity");
      if (loadError) throw loadError;

      const itemKey = (c, s) => `${c}||${s}`;
      const itemByKey = new Map(
        (freshItems || []).map((row) => [itemKey(row.category, row.subtype), { id: row.id, quantity: row.quantity }])
      );

      for (const line of normalizedLines) {
        const k = itemKey(line.category, line.subtype);
        const existing = itemByKey.get(k);

        if (existing) {
          const newQuantity = existing.quantity + line.quantity;
          const { error: updateError } = await supabase.from("items").update({ quantity: newQuantity }).eq("id", existing.id);
          if (updateError) throw updateError;

          const { error: historyError } = await supabase.from("history").insert([
            {
              item_id: existing.id,
              action: "add",
              quantity_changed: line.quantity,
              worker_name: workerName.trim(),
            },
          ]);
          if (historyError) throw historyError;

          itemByKey.set(k, { id: existing.id, quantity: newQuantity });
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("items")
            .insert([{ category: line.category, subtype: line.subtype, quantity: line.quantity }])
            .select("id");
          if (insertError) throw insertError;

          const { error: historyError } = await supabase.from("history").insert([
            {
              item_id: inserted[0].id,
              action: "add",
              quantity_changed: line.quantity,
              worker_name: workerName.trim(),
            },
          ]);
          if (historyError) throw historyError;

          itemByKey.set(k, { id: inserted[0].id, quantity: line.quantity });
        }
      }

      setMessage({
        text: `Success! Added stock for ${normalizedLines.length} line(s)`,
        type: "success",
      });
      setStockLines([{ category: "", subtype: "", quantity: "" }]);
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      fetchItems();
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-item">
      <h2>Update Stock</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
            Your Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            required
          />
        </div>

        <div className="sales-items-panel">
          <h3 className="sales-items-title">Items to restock</h3>
          {stockLines.map((line, index) => (
            <div key={index} className="sales-line-row">
              <select
                value={line.category}
                onChange={(e) => updateStockLine(index, "category", e.target.value)}
                required
                className="sales-line-field"
              >
                <option value="">Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={line.subtype}
                onChange={(e) => updateStockLine(index, "subtype", e.target.value)}
                required
                disabled={!line.category}
                className="sales-line-field"
              >
                <option value="">Subtype</option>
                {getSubtypesForCategory(line.category).map((subtype) => (
                  <option key={subtype} value={subtype}>
                    {subtype}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateStockLine(index, "quantity", e.target.value)}
                required
                className="sales-line-field sales-qty-field"
              />
              <button
                type="button"
                onClick={() => removeStockLine(index)}
                disabled={stockLines.length === 1}
                className="sales-remove-btn"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addStockLine} className="sales-add-btn">
            + Add another product
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add to stock (all lines)"}
        </button>
      </form>
      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}
