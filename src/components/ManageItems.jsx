import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ManageItems() {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [newSubtype, setNewSubtype] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

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
      setMessage({ text: `Error loading categories: ${err.message}`, type: "error" });
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!newCategory.trim()) {
      setMessage({ text: "Please enter a category name", type: "error" });
      setLoading(false);
      return;
    }

    if (categories.includes(newCategory)) {
      setMessage({ text: "This category already exists", type: "error" });
      setLoading(false);
      return;
    }

    try {
      // Add a placeholder subtype so the category appears in the list
      const { error } = await supabase
        .from('items')
        .insert([{ 
          category: newCategory, 
          subtype: "Default",
          quantity: 0
        }]);

      if (error) throw error;

      setMessage({ 
        text: `Category "${newCategory}" created successfully`, 
        type: "success" 
      });
      setNewCategory("");
      await fetchCategories();
      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubtype = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!selectedCategory) {
      setMessage({ text: "Please select a category", type: "error" });
      setLoading(false);
      return;
    }

    if (!newSubtype.trim()) {
      setMessage({ text: "Please enter a subtype name", type: "error" });
      setLoading(false);
      return;
    }

    try {
      // Check if subtype already exists
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('category', selectedCategory)
        .eq('subtype', newSubtype)
        .single();

      if (existing) {
        setMessage({ text: "This subtype already exists in this category", type: "error" });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('items')
        .insert([{ 
          category: selectedCategory, 
          subtype: newSubtype,
          quantity: 0
        }]);

      if (error) throw error;

      setMessage({ 
        text: `Subtype "${newSubtype}" added to "${selectedCategory}"`, 
        type: "success" 
      });
      setNewSubtype("");
      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    } catch (err) {
      setMessage({ text: `Error: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manage-items">
      <h2>Manage Food Items</h2>
      
      <div className="manage-container">
        <div className="manage-section">
          <h3>Add New Category</h3>
          <form onSubmit={handleAddCategory}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Category Name
              </label>
              <input
                type="text"
                placeholder="e.g., Biryani, Pizza, Burger"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Category"}
            </button>
          </form>
        </div>

        <div className="manage-section">
          <h3>Add Subitem to Category</h3>
          <form onSubmit={handleAddSubtype}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Select Category
              </label>
              <select 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
                required
              >
                <option value="">Choose a category...</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Subitem Name
              </label>
              <input
                type="text"
                placeholder="e.g., Chicken, Veg, Spicy"
                value={newSubtype}
                onChange={e => setNewSubtype(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Subitem"}
            </button>
          </form>
        </div>
      </div>

      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}
