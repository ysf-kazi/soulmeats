import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, query, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function StaffMenuManager() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", price: "", categoryId: "", availableDays: [], temporarilyUnavailable: false });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "menuItems")), (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    }, () => setError("Unable to load menu items."));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "categories")), (snapshot) => {
      setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.active !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    }, () => setError("Unable to load categories."));
    return () => unsubscribe();
  }, []);

  function resetForm() {
    setForm({ name: "", description: "", price: "", categoryId: categories[0]?.id || "", availableDays: [], temporarilyUnavailable: false });
    setEditingId(null);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({ name: item.name || "", description: item.description || "", price: item.price ?? "", categoryId: item.categoryId || "", availableDays: Array.isArray(item.availableDays) ? item.availableDays : [], temporarilyUnavailable: item.temporarilyUnavailable === true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleDay(day) {
    setForm((current) => ({ ...current, availableDays: current.availableDays.includes(day) ? current.availableDays.filter((item) => item !== day) : [...current.availableDays, day] }));
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!form.name.trim()) return setError("Item name is required.");
    if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) return setError("Enter a valid price.");
    try {
      setSaving(true); setError("");
      const data = { name: form.name.trim(), description: form.description.trim(), price: Number(form.price), categoryId: form.categoryId, active: true, temporarilyUnavailable: form.temporarilyUnavailable, availableDays: form.availableDays, imageUrl: editingId ? items.find((item) => item.id === editingId)?.imageUrl || "" : "", sortOrder: editingId ? items.find((item) => item.id === editingId)?.sortOrder || 0 : items.length + 1, updatedAt: new Date() };
      if (editingId) await updateDoc(doc(db, "menuItems", editingId), data);
      else await addDoc(collection(db, "menuItems"), { ...data, createdAt: new Date() });
      resetForm();
    } catch (error) {
      console.error("Menu item save error:", error); setError("Unable to save the menu item.");
    } finally { setSaving(false); }
  }

  async function removeItem(item) {
    if (!window.confirm(`Remove ${item.name} from the customer menu?`)) return;
    try { await updateDoc(doc(db, "menuItems", item.id), { active: false, updatedAt: new Date() }); }
    catch (error) { console.error(error); setError("Unable to remove the item."); }
  }

  async function restoreItem(item) {
    try { await updateDoc(doc(db, "menuItems", item.id), { active: true, updatedAt: new Date() }); }
    catch (error) { console.error(error); setError("Unable to restore the item."); }
  }

  async function toggleTemporary(item) {
    try { await updateDoc(doc(db, "menuItems", item.id), { temporarilyUnavailable: item.temporarilyUnavailable !== true, updatedAt: new Date() }); }
    catch (error) { console.error(error); setError("Unable to change availability."); }
  }

  return <div className="staff-dashboard">
    <header className="staff-dashboard-header">
      <div className="staff-brand"><div className="staff-brand-logo">S🔥</div><div><h1>Soulmeats</h1><p>Item Management</p></div></div>
      <a className="staff-back-button" href="/staff">← Dashboard</a>
    </header>
    <main className="staff-dashboard-content">
      <section className="staff-welcome-card"><div><span className="staff-eyebrow">MENU CONTROL</span><h2>Item Management</h2><p>Add, edit, remove and control when menu items are available to customers.</p></div></section>
      {error && <div className="staff-error"><strong>Something went wrong</strong><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
      <section className="staff-menu-manager-card">
        <div className="staff-section-header"><div><span className="staff-section-kicker">{editingId ? "EDIT ITEM" : "NEW ITEM"}</span><h2>{editingId ? "Edit Menu Item" : "Add Menu Item"}</h2></div></div>
        <form className="staff-menu-form" onSubmit={saveItem}>
          <label><span>Item name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chicken Burger" required /></label>
          <label><span>Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the item" /></label>
          <label><span>Price (Tzs)</span><input type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label><span>Category</span><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <div className="staff-menu-days"><span>Available only on these days</span><p>Leave every day unchecked to make the item available every day.</p><div>{DAYS.map((day) => <button type="button" key={day} className={form.availableDays.includes(day) ? "staff-day-button active" : "staff-day-button"} onClick={() => toggleDay(day)}>{day.slice(0, 3)}</button>)}</div></div>
          <label className="staff-checkbox-label"><input type="checkbox" checked={form.temporarilyUnavailable} onChange={(e) => setForm({ ...form, temporarilyUnavailable: e.target.checked })} /><span>Temporarily unavailable</span></label>
          <div className="staff-menu-form-actions"><button className="staff-primary-action" disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Add Item"}</button>{editingId && <button type="button" className="staff-secondary-action" onClick={resetForm}>Cancel</button>}</div>
        </form>
      </section>

      <section className="staff-orders-section"><div className="staff-section-header"><div><span className="staff-section-kicker">MENU</span><h2>All Items</h2><p>Removed items stay in Firestore so old orders are not damaged.</p></div><span className="staff-order-count">{items.length}</span></div>
        <div className="staff-menu-admin-list">{items.map((item) => <article className={item.active === false ? "staff-menu-admin-card inactive" : "staff-menu-admin-card"} key={item.id}>
          <div className="staff-menu-admin-main"><div><span className="staff-card-label">{item.active === false ? "REMOVED" : "MENU ITEM"}</span><h3>{item.name}</h3><p>{item.description || "No description"}</p><strong>Tzs {Number(item.price || 0).toLocaleString()}</strong></div><div className="staff-menu-admin-status">{item.temporarilyUnavailable ? "Temporarily unavailable" : Array.isArray(item.availableDays) && item.availableDays.length ? `Only ${item.availableDays.join(", ")}` : "Every day"}</div></div>
          <div className="staff-menu-admin-actions"><button className="staff-secondary-action" onClick={() => startEdit(item)}>Edit</button>{item.active === false ? <button className="staff-secondary-action" onClick={() => restoreItem(item)}>Restore</button> : <><button className="staff-secondary-action" onClick={() => toggleTemporary(item)}>{item.temporarilyUnavailable ? "Make Available" : "Temporary Disable"}</button><button className="staff-danger-action" onClick={() => removeItem(item)}>Remove</button></>}</div>
        </article>)}</div>
      </section>
    </main>
  </div>;
}
