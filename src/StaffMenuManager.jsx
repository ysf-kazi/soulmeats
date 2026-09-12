import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function StaffMenuManager() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    availableDays: [],
    temporarilyUnavailable: false,
  });

  const [editingId, setEditingId] = useState(null);

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    sortOrder: "",
  });

  const [editingCategoryId, setEditingCategoryId] =
    useState(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingCategory, setSavingCategory] =
    useState(false);

  /* =========================================================
     LOAD MENU ITEMS
     ========================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "menuItems")),
      (snapshot) => {
        setItems(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .sort(
              (a, b) =>
                (a.sortOrder || 0) -
                (b.sortOrder || 0)
            )
        );
      },
      (snapshotError) => {
        console.error(
          "Menu items listener error:",
          snapshotError
        );

        setError(
          "Unable to load menu items."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     LOAD CATEGORIES
     ========================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "categories")),
      (snapshot) => {
        setCategories(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              ...item.data(),
            }))
            .sort(
              (a, b) =>
                (a.sortOrder || 0) -
                (b.sortOrder || 0)
            )
        );
      },
      (snapshotError) => {
        console.error(
          "Categories listener error:",
          snapshotError
        );

        setError(
          "Unable to load categories."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     RESET ITEM FORM
     ========================================================= */

  function resetForm() {
    const activeCategories =
      categories.filter(
        (category) => category.active !== false
      );

    setForm({
      name: "",
      description: "",
      price: "",
      categoryId:
        activeCategories[0]?.id || "",
      availableDays: [],
      temporarilyUnavailable: false,
    });

    setEditingId(null);
  }

  /* =========================================================
     EDIT MENU ITEM
     ========================================================= */

  function startEdit(item) {
  setEditingId(item.id);

  setForm({
    name: item.name || "",
    description: item.description || "",
    price: item.price ?? "",
    categoryId: item.categoryId || "",
    availableDays: Array.isArray(
      item.availableDays
    )
      ? item.availableDays
      : [],
    temporarilyUnavailable:
      item.temporarilyUnavailable === true,
  });

  setTimeout(() => {
    document
      .getElementById("item-management-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, 100);
}

  /* =========================================================
     TOGGLE AVAILABLE DAY
     ========================================================= */

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      availableDays:
        current.availableDays.includes(day)
          ? current.availableDays.filter(
              (item) => item !== day
            )
          : [
              ...current.availableDays,
              day,
            ],
    }));
  }

  /* =========================================================
     SAVE MENU ITEM
     ========================================================= */

  async function saveItem(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Item name is required.");
      return;
    }

    if (
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Enter a valid price.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const existingItem = editingId
        ? items.find(
            (item) => item.id === editingId
          )
        : null;

      const data = {
        name: form.name.trim(),
        description:
          form.description.trim(),
        price: Number(form.price),
        categoryId: form.categoryId,
        active: true,
        temporarilyUnavailable:
          form.temporarilyUnavailable,
        availableDays: form.availableDays,
        imageUrl:
          existingItem?.imageUrl || "",
        sortOrder:
          existingItem?.sortOrder ||
          items.length + 1,
        updatedAt: new Date(),
      };

      if (editingId) {
        await updateDoc(
          doc(db, "menuItems", editingId),
          data
        );
      } else {
        await addDoc(
          collection(db, "menuItems"),
          {
            ...data,
            createdAt: new Date(),
          }
        );
      }

      resetForm();
    } catch (error) {
      console.error(
        "Menu item save error:",
        error
      );

      setError(
        "Unable to save the menu item."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     REMOVE MENU ITEM
     ========================================================= */

  async function removeItem(item) {
    if (
      !window.confirm(
        `Remove ${item.name} from the customer menu?`
      )
    ) {
      return;
    }

    try {
      await updateDoc(
        doc(db, "menuItems", item.id),
        {
          active: false,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(error);

      setError(
        "Unable to remove the item."
      );
    }
  }

  /* =========================================================
     RESTORE MENU ITEM
     ========================================================= */

  async function restoreItem(item) {
    try {
      await updateDoc(
        doc(db, "menuItems", item.id),
        {
          active: true,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(error);

      setError(
        "Unable to restore the item."
      );
    }
  }

  /* =========================================================
     TEMPORARY ITEM AVAILABILITY
     ========================================================= */

  async function toggleTemporary(item) {
    try {
      await updateDoc(
        doc(db, "menuItems", item.id),
        {
          temporarilyUnavailable:
            item.temporarilyUnavailable !== true,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(error);

      setError(
        "Unable to change availability."
      );
    }
  }

  /* =========================================================
     CATEGORY FORM
     ========================================================= */

  function resetCategoryForm() {
    setCategoryForm({
      name: "",
      sortOrder: "",
    });

    setEditingCategoryId(null);
  }

  /* =========================================================
     START EDIT CATEGORY
     ========================================================= */

  function startEditCategory(category) {
  setEditingCategoryId(category.id);

  setCategoryForm({
    name: category.name || "",
    sortOrder: category.sortOrder ?? "",
  });

  setTimeout(() => {
    document
      .getElementById("category-management-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, 100);
}

  /* =========================================================
     SAVE CATEGORY
     ========================================================= */

  async function saveCategory(event) {
    event.preventDefault();

    const categoryName =
      categoryForm.name.trim();

    if (!categoryName) {
      setError(
        "Category name is required."
      );
      return;
    }

    const enteredSortOrder =
      Number(categoryForm.sortOrder);

    if (
      categoryForm.sortOrder !== "" &&
      (!Number.isFinite(
        enteredSortOrder
      ) ||
        enteredSortOrder < 0)
    ) {
      setError(
        "Enter a valid category sort order."
      );
      return;
    }

    try {
      setSavingCategory(true);
      setError("");

      if (editingCategoryId) {
        await updateDoc(
          doc(
            db,
            "categories",
            editingCategoryId
          ),
          {
            name: categoryName,
            sortOrder:
              categoryForm.sortOrder === ""
                ? 0
                : enteredSortOrder,
            updatedAt: new Date(),
          }
        );
      } else {
        const highestSortOrder =
          categories.reduce(
            (highest, category) =>
              Math.max(
                highest,
                Number(
                  category.sortOrder || 0
                )
              ),
            0
          );

        await addDoc(
          collection(db, "categories"),
          {
            name: categoryName,

            /*
             * New categories are ACTIVE
             * by default.
             */
            active: true,

            sortOrder:
              categoryForm.sortOrder === ""
                ? highestSortOrder + 1
                : enteredSortOrder,

            createdAt: new Date(),
            updatedAt: new Date(),
          }
        );
      }

      resetCategoryForm();
    } catch (error) {
      console.error(
        "Category save error:",
        error
      );

      setError(
        "Unable to save the category."
      );
    } finally {
      setSavingCategory(false);
    }
  }

  /* =========================================================
     TOGGLE CATEGORY ACTIVE
     ========================================================= */

  async function toggleCategory(category) {
    const newActive =
      category.active === false;

    if (
      !newActive &&
      !window.confirm(
        `Deactivate "${category.name}"? Menu items using this category will no longer show this category on the customer menu.`
      )
    ) {
      return;
    }

    try {
      await updateDoc(
        doc(
          db,
          "categories",
          category.id
        ),
        {
          active: newActive,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(
        "Category status error:",
        error
      );

      setError(
        "Unable to change category status."
      );
    }
  }

  /* =========================================================
     ACTIVE CATEGORIES FOR ITEM FORM
     ========================================================= */

  const activeCategories =
    categories.filter(
      (category) =>
        category.active !== false
    );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="staff-dashboard">

      <header className="staff-dashboard-header">

        <div className="staff-brand">

          <div className="staff-brand-logo">
            S🔥
          </div>

          <div>
            <h1>Soulmeats</h1>
            <p>Item Management</p>
          </div>

        </div>

        <a
          className="staff-back-button"
          href={`${import.meta.env.BASE_URL}staff`}
        >
          ← Dashboard
        </a>

      </header>

      <main className="staff-dashboard-content">

        <section className="staff-welcome-card">

          <div>

            <span className="staff-eyebrow">
              MENU CONTROL
            </span>

            <h2>
              Item Management
            </h2>

            <p>
              Manage categories and menu items,
              including prices, availability
              and active status.
            </p>

          </div>

        </section>

        {error && (
          <div className="staff-error">

            <strong>
              Something went wrong
            </strong>

            <span>{error}</span>

            <button
              onClick={() => setError("")}
            >
              Dismiss
            </button>

          </div>
        )}

        {/* ===================================================
            CATEGORY MANAGEMENT
            =================================================== */}

        <section
  id="category-management-form"
  className="staff-menu-manager-card"
>
          <div className="staff-section-header">

            <div>

              <span className="staff-section-kicker">
                CATEGORIES
              </span>

              <h2>
                Category Management
              </h2>

              <p>
                Create categories, change their
                order and control which categories
                appear on the customer menu.
              </p>

            </div>

            <span className="staff-order-count">
              {categories.length}
            </span>

          </div>

          <form
            className="staff-menu-form"
            onSubmit={saveCategory}
          >

            <label>

              <span>
                Category name
              </span>

              <input
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    name: event.target.value,
                  })
                }
                placeholder="e.g. Offers"
                required
              />

            </label>

            <label>

              <span>
                Sort order
              </span>

              <input
                type="number"
                min="0"
                step="1"
                value={
                  categoryForm.sortOrder
                }
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    sortOrder:
                      event.target.value,
                  })
                }
                placeholder="e.g. 1"
              />

            </label>

            <div className="staff-menu-form-actions">

              <button
                className="staff-primary-action"
                disabled={savingCategory}
              >
                {savingCategory
                  ? "Saving..."
                  : editingCategoryId
                  ? "Save Category"
                  : "Add Category"}
              </button>

              {editingCategoryId && (
                <button
                  type="button"
                  className="staff-secondary-action"
                  onClick={
                    resetCategoryForm
                  }
                >
                  Cancel
                </button>
              )}

            </div>

          </form>

          <div className="staff-menu-admin-list">

            {categories.length === 0 ? (

              <div className="staff-empty-card">

                <div className="staff-empty-icon">
                  +
                </div>

                <h3>
                  No categories yet
                </h3>

                <p>
                  Create your first menu
                  category above.
                </p>

              </div>

            ) : (

              categories.map((category) => (

                <article
                  className={
                    category.active === false
                      ? "staff-menu-admin-card inactive"
                      : "staff-menu-admin-card"
                  }
                  key={category.id}
                >

                  <div className="staff-menu-admin-main">

                    <div>

                      <span className="staff-card-label">

                        {category.active === false
                          ? "INACTIVE"
                          : "CATEGORY"}

                      </span>

                      <h3>
                        {category.name}
                      </h3>

                      <p>
                        Sort order:{" "}
                        {category.sortOrder ??
                          0}
                      </p>

                    </div>

                    <div className="staff-menu-admin-status">

                      {category.active === false
                        ? "Not shown to customers"
                        : "Active"}

                    </div>

                  </div>

                  <div className="staff-menu-admin-actions">

                    <button
                      className="staff-secondary-action"
                      onClick={() =>
                        startEditCategory(
                          category
                        )
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="staff-secondary-action"
                      onClick={() =>
                        toggleCategory(
                          category
                        )
                      }
                    >
                      {category.active === false
                        ? "Activate"
                        : "Deactivate"}
                    </button>

                  </div>

                </article>

              ))

            )}

          </div>

        </section>

        {/* ===================================================
            MENU ITEM FORM
            =================================================== */}

        <section
  id="item-management-form"
  className="staff-menu-manager-card"
>

          <div className="staff-section-header">

            <div>

              <span className="staff-section-kicker">
                {editingId
                  ? "EDIT ITEM"
                  : "NEW ITEM"}
              </span>

              <h2>
                {editingId
                  ? "Edit Menu Item"
                  : "Add Menu Item"}
              </h2>

            </div>

          </div>

          <form
            className="staff-menu-form"
            onSubmit={saveItem}
          >

            <label>

              <span>
                Item name
              </span>

              <input
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                placeholder="e.g. Chicken Burger"
                required
              />

            </label>

            <label>

              <span>
                Description
              </span>

              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description:
                      event.target.value,
                  })
                }
                placeholder="Describe the item"
              />

            </label>

            <label>

              <span>
                Price (Tzs)
              </span>

              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(event) =>
                  setForm({
                    ...form,
                    price: event.target.value,
                  })
                }
                required
              />

            </label>

            <label>

              <span>
                Category
              </span>

              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    categoryId:
                      event.target.value,
                  })
                }
              >

                <option value="">
                  No category
                </option>

                {activeCategories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  )
                )}

              </select>

            </label>

            <div className="staff-menu-days">

              <span>
                Available only on these days
              </span>

              <p>
                Leave every day unchecked
                to make the item available
                every day.
              </p>

              <div>

                {DAYS.map((day) => (

                  <button
                    type="button"
                    key={day}
                    className={
                      form.availableDays.includes(
                        day
                      )
                        ? "staff-day-button active"
                        : "staff-day-button"
                    }
                    onClick={() =>
                      toggleDay(day)
                    }
                  >
                    {day.slice(0, 3)}
                  </button>

                ))}

              </div>

            </div>

            <label className="staff-checkbox-label">

              <input
                type="checkbox"
                checked={
                  form.temporarilyUnavailable
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    temporarilyUnavailable:
                      event.target.checked,
                  })
                }
              />

              <span>
                Temporarily unavailable
              </span>

            </label>

            <div className="staff-menu-form-actions">

              <button
                className="staff-primary-action"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Save Changes"
                  : "Add Item"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="staff-secondary-action"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}

            </div>

          </form>

        </section>

        {/* ===================================================
            ALL MENU ITEMS
            =================================================== */}

        <section className="staff-orders-section">

          <div className="staff-section-header">

            <div>

              <span className="staff-section-kicker">
                MENU
              </span>

              <h2>
                All Items
              </h2>

              <p>
                Removed items stay in Firestore
                so old orders are not damaged.
              </p>

            </div>

            <span className="staff-order-count">
              {items.length}
            </span>

          </div>

          <div className="staff-menu-admin-list">

            {items.map((item) => (

              <article
                className={
                  item.active === false
                    ? "staff-menu-admin-card inactive"
                    : "staff-menu-admin-card"
                }
                key={item.id}
              >

                <div className="staff-menu-admin-main">

                  <div>

                    <span className="staff-card-label">

                      {item.active === false
                        ? "REMOVED"
                        : "MENU ITEM"}

                    </span>

                    <h3>
                      {item.name}
                    </h3>

                    <p>
                      {item.description ||
                        "No description"}
                    </p>

                    <strong>
                      Tzs{" "}
                      {Number(
                        item.price || 0
                      ).toLocaleString()}
                    </strong>

                  </div>

                  <div className="staff-menu-admin-status">

                    {item.temporarilyUnavailable
                      ? "Temporarily unavailable"
                      : Array.isArray(
                          item.availableDays
                        ) &&
                        item.availableDays
                          .length
                      ? `Only ${item.availableDays.join(
                          ", "
                        )}`
                      : "Every day"}

                  </div>

                </div>

                <div className="staff-menu-admin-actions">

                  <button
                    className="staff-secondary-action"
                    onClick={() =>
                      startEdit(item)
                    }
                  >
                    Edit
                  </button>

                  {item.active === false ? (

                    <button
                      className="staff-secondary-action"
                      onClick={() =>
                        restoreItem(item)
                      }
                    >
                      Restore
                    </button>

                  ) : (

                    <>
                      <button
                        className="staff-secondary-action"
                        onClick={() =>
                          toggleTemporary(item)
                        }
                      >
                        {item.temporarilyUnavailable
                          ? "Make Available"
                          : "Temporary Disable"}
                      </button>

                      <button
                        className="staff-danger-action"
                        onClick={() =>
                          removeItem(item)
                        }
                      >
                        Remove
                      </button>
                    </>

                  )}

                </div>

              </article>

            ))}

          </div>

        </section>

      </main>

    </div>
  );
}