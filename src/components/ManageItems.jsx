import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ManageItems() {
  const [categories, setCategories] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [subtypeName, setSubtypeName] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from("items").select("category").order("category");
      if (error) throw error;
      const uniqueCategories = [...new Set(data?.map((item) => item.category) || [])].sort();
      setCategories(uniqueCategories);
    } catch (err) {
      setMessage({ text: `Error loading categories: ${err.message}`, type: "error" });
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    const category = categoryName.trim();
    const subtype = subtypeName.trim();

    if (!category || !subtype) {
      setMessage({ text: "Please enter category and subtype names", type: "error" });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.rpc("add_category_subtype", {
        p_category: category,
        p_subtype: subtype,
      });

      if (error) throw error;

      setMessage({ text: `Added "${subtype}" under "${category}"`, type: "success" });
      setSubtypeName("");
      if (!categories.includes(category)) setCategoryName("");
      await fetchCategories();
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
          <h3>Add Category / Subitem</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Pick an existing category or type a new one. Each row is a real product (no placeholder items).
          </p>
          <form onSubmit={handleAddItem}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Category
              </label>
              <input
                type="text"
                list="category-suggestions"
                placeholder="e.g. Samosa, Falafel"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
              <datalist id="category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Subitem name
              </label>
              <input
                type="text"
                placeholder="e.g. Chicken, Veg, Cheese"
                value={subtypeName}
                onChange={(e) => setSubtypeName(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add item"}
            </button>
          </form>
        </div>
      </div>

      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}
