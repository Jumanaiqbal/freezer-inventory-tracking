import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function AddItem() {
  const [workerName, setWorkerName] = useState("");
  const [category, setCategory] = useState("");
  const [subtype, setSubtype] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subtypes, setSubtypes] = useState([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('category')
        .order('category');
      
      if (error) throw error;
      const uniqueCategories = [...new Set(data?.map(item => item.category) || [])].sort();
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const fetchSubtypes = async (selectedCategory) => {
    if (!selectedCategory) {
      setSubtypes([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('items')
        .select('subtype')
        .eq('category', selectedCategory)
        .order('subtype');
      
      if (error) throw error;
      const uniqueSubtypes = [...new Set(data?.map(item => item.subtype) || [])].sort();
      setSubtypes(uniqueSubtypes);
    } catch (err) {
      console.error('Error loading subtypes:', err);
    }
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

    try {
      const quantityToAdd = parseInt(quantity);
      
      // Check if item already exists
      const { data: existing } = await supabase
        .from('items')
        .select('id, quantity')
        .eq('category', category)
        .eq('subtype', subtype)
        .single();

      if (existing) {
        // Item exists - ADD to the existing quantity
        const newQuantity = existing.quantity + quantityToAdd;
        const { error } = await supabase
          .from('items')
          .update({ quantity: newQuantity })
          .eq('id', existing.id);

        if (error) throw error;

        setMessage({ 
          text: `Success! Added ${quantity} pieces`, 
          type: "success" 
        });
      } else {
        // Item doesn't exist - CREATE new item
        const { error } = await supabase
          .from('items')
          .insert([{ category, subtype, quantity: quantityToAdd }]);

        if (error) throw error;

        setMessage({ 
          text: `Success! Added ${quantity} pieces`, 
          type: "success" 
        });
      }

      setCategory("");
      setSubtype("");
      setQuantity("");
      setWorkerName("");
      setTimeout(() => setMessage({ text: "", type: "" }), 4000);
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
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Your Name
          </label>
          <input 
            type="text"
            placeholder="Enter your name"
            value={workerName}
            onChange={e => setWorkerName(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Product Category
          </label>
          <select 
            value={category} 
            onChange={e => { 
              setCategory(e.target.value);
              setSubtype("");
              fetchSubtypes(e.target.value);
            }} 
            required
          >
            <option value="">Select a category...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Subtype
          </label>
          <select
            value={subtype}
            onChange={e => setSubtype(e.target.value)}
            required
            disabled={!category}
          >
            <option value="">Select a subtype...</option>
            {subtypes.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
            Initial Quantity (pieces)
          </label>
          <input
            type="number"
            placeholder="Enter quantity"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            min="0"
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Item"}
        </button>
      </form>
      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}