import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function UpdateStock() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubtype, setSelectedSubtype] = useState("");
  const [quantityChange, setQuantityChange] = useState("");
  const [action] = useState("remove"); // Sales only removes items
  const [workerName, setWorkerName] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('category').order('subtype');
    if (data) {
      setItems(data);
      const uniqueCategories = [...new Set(data.map(item => item.category))].sort();
      setCategories(uniqueCategories);
    }
  };

  const filteredItems = items.filter(item => item.category === selectedCategory);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    const item = items.find(i => i.category === selectedCategory && i.subtype === selectedSubtype);
    if (!item) {
      setMessage({ text: "Item not found", type: "error" });
      setLoading(false);
      return;
    }

    const change = parseInt(quantityChange);

    // Check if trying to remove more than available stock
    if (change > item.quantity) {
      setMessage({ text: "Cannot remove - not enough stock available", type: "error" });
      setLoading(false);
      return;
    }

    const newQuantity = action === "add" ? item.quantity + change : item.quantity - change;

    // Allow any quantity (even negative if needed for corrections)
    const finalQuantity = Math.max(0, newQuantity); // Minimum is 0

    try {
      // Update quantity
      const { error: updateError } = await supabase
        .from('items')
        .update({ quantity: finalQuantity })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // Log to history
      const { error: historyError } = await supabase
        .from('history')
        .insert([{
          item_id: item.id,
          action: action,
          quantity_changed: change,
          worker_name: workerName || "Unknown"
        }]);

      if (historyError) throw historyError;

      setMessage({ 
        text: `Success! Removed ${change} pieces`, 
        type: "success" 
      });
      setQuantityChange("");
      setSelectedSubtype("");
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
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
            Product Category
          </label>
          <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedSubtype(""); }} required>
            <option value="">Select a category...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {selectedCategory && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
              Subtype
            </label>
            <select value={selectedSubtype} onChange={e => setSelectedSubtype(e.target.value)} required>
              <option value="">Select a subtype...</option>
              {filteredItems.map(item => (
                <option key={item.id} value={item.subtype}>
                  {item.subtype}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Quantity to Remove (pieces)
          </label>
          <input
            type="number"
            placeholder="Enter amount to remove"
            value={quantityChange}
            onChange={e => setQuantityChange(e.target.value)}
            min="1"
            required
          />
          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Enter the quantity you want to remove from stock
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Remove from Stock"}
        </button>
      </form>
      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}