import { lazy, Suspense, useEffect, useMemo, useState } from "react";

const StaffArea = lazy(() => import("./StaffArea"));

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebaseCustomer";

import "./App.css";

function App() {
  /* =========================================================
     STAFF AREA
     ========================================================= */

  const isStaffPage = window.location.pathname.startsWith("/soulmeats/staff");

  if (isStaffPage) {
    return (
      <Suspense
        fallback={
          <div className="staff-loading">
            Loading...
          </div>
        }
      >
        <StaffArea/>
      </Suspense>
    );
  }

  /* =========================================================
     CUSTOMER AREA
     ========================================================= */

  const params = new URLSearchParams(window.location.search);

  const rawTableCode = params.get("table") || "T01";

  function normalizeTableCode(code) {
    if (!code) return "T01";

    const upperCode = code.toUpperCase();

    if (/^S\d$/.test(upperCode)) {
      return `S0${upperCode.substring(1)}`;
    }

    return upperCode;
  }

  const tableCode = normalizeTableCode(rawTableCode);

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState("");

  const [showCart, setShowCart] = useState(false);
  const [showBill, setShowBill] = useState(false);

  const [activeSession, setActiveSession] = useState(null);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [gettingBill, setGettingBill] = useState(false);

  const [message, setMessage] = useState("");

  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);

  const [selcomOpen, setSelcomOpen] = useState(false);
  const [selcomCopied, setSelcomCopied] = useState(false);
  const [sharingTransaction, setSharingTransaction] = useState(false);

  const payBillNumber = "61220229";
  const whatsappNumber = "255658898989";

  function getTodayName() {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(new Date());
  }

  function getItemAvailability(item) {
    if (item.temporarilyUnavailable === true) {
      return {
        available: false,
        label: "Temporarily unavailable",
      };
    }

    const availableDays = Array.isArray(item.availableDays)
      ? item.availableDays
      : [];

    if (availableDays.length === 0) {
      return {
        available: true,
        label: "Available",
      };
    }

    const today = getTodayName();
    const available = availableDays.includes(today);

    return {
      available,
      label: available
        ? "Available today"
        : `Available only ${availableDays.join(", ")}`,
    };
  }

  /* =========================================================
     LOAD MENU
     ========================================================= */

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoadingMenu(true);
        setMenuError("");

        const categoriesSnapshot = await getDocs(
          query(
            collection(db, "categories"),
            where("active", "==", true)
          )
        );

        const categoryData = categoriesSnapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort(
            (a, b) =>
              (a.sortOrder || 0) - (b.sortOrder || 0)
          );

        setCategories(categoryData);

        const menuSnapshot = await getDocs(
          query(
            collection(db, "menuItems"),
            where("active", "==", true)
          )
        );

        const menuData = menuSnapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort(
            (a, b) =>
              (a.sortOrder || 0) - (b.sortOrder || 0)
          );

        setMenuItems(menuData);
      } catch (error) {
        console.error("Menu loading error:", error);
        setMenuError(
          "Unable to load the menu. Please try again."
        );
      } finally {
        setLoadingMenu(false);
      }
    }

    loadMenu();
  }, []);

  /* =========================================================
     SESSION
     ========================================================= */

  async function getActiveTableSession() {
    const sessionQuery = query(
      collection(db, "tableSessions"),
      where("tableCode", "==", tableCode),
      where("status", "==", "active"),
      limit(1)
    );

    const sessionSnapshot = await getDocs(sessionQuery);

    if (!sessionSnapshot.empty) {
      const sessionDocument =
        sessionSnapshot.docs[0];

      const session = {
        id: sessionDocument.id,
        ...sessionDocument.data(),
      };

      setActiveSession(session);

      return session;
    }

    const sessionReference = await addDoc(
      collection(db, "tableSessions"),
      {
        tableCode,
        tableId: tableCode,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    const newSession = {
      id: sessionReference.id,
      tableCode,
      tableId: tableCode,
      status: "active",
    };

    setActiveSession(newSession);

    return newSession;
  }

  /* =========================================================
     MENU / SEARCH
     ========================================================= */

  const filteredMenuItems = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return menuItems.filter((item) => {
      const category = categories.find(
        (categoryItem) =>
          categoryItem.id === item.categoryId
      );

      const categoryName = category?.name || "";

      const matchesCategory =
        selectedCategory === "all" ||
        item.categoryId === selectedCategory;

      const searchableText = [
        item.name || "",
        item.description || "",
        categoryName,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search || searchableText.includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [
    menuItems,
    categories,
    searchText,
    selectedCategory,
  ]);

  function getCategoryName(categoryId) {
    const category = categories.find(
      (item) => item.id === categoryId
    );

    return category?.name || "";
  }

  /* =========================================================
     CART
     ========================================================= */

  function getCartQuantity(itemId) {
    const cartItem = cart.find(
      (item) => item.id === itemId
    );

    return cartItem?.quantity || 0;
  }

  function addToCart(item) {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) => cartItem.id === item.id
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
        );
      }

      return [
        ...currentCart,
        {
          id: item.id,
          name: item.name,
          description: item.description || "",
          price: Number(item.price || 0),
          quantity: 1,
        },
      ];
    });
  }

  function increaseQuantity(itemId) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(itemId) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === itemId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function updateCartQuantity(itemId, value) {
    const quantity = Number(value);

    if (!Number.isFinite(quantity)) {
      return;
    }

    if (quantity <= 0) {
      setCart((currentCart) =>
        currentCart.filter(
          (item) => item.id !== itemId
        )
      );

      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.floor(quantity),
            }
          : item
      )
    );
  }

  function removeFromCart(itemId) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.id !== itemId
      )
    );
  }

  const cartCount = useMemo(() => {
    return cart.reduce(
      (total, item) => total + item.quantity,
      0
    );
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce(
      (total, item) =>
        total + item.price * item.quantity,
      0
    );
  }, [cart]);

  /* =========================================================
     MONEY / DATE
     ========================================================= */

  function formatMoney(amount) {
    return `Tzs ${Number(
      amount || 0
    ).toLocaleString()}`;
  }

  function formatDate(value) {
    if (!value) return "";

    try {
      const date =
        typeof value.toDate === "function"
          ? value.toDate()
          : new Date(value);

      return date.toLocaleString();
    } catch {
      return "";
    }
  }

  /* =========================================================
     ORDER ID
     ========================================================= */

  function generateOrderId() {
    const now = new Date();

    const hours = String(
      now.getHours()
    ).padStart(2, "0");

    const minutes = String(
      now.getMinutes()
    ).padStart(2, "0");

    return `${tableCode}${hours}${minutes}`;
  }

  /* =========================================================
     PLACE ORDER
     ========================================================= */

  async function placeOrder() {
    if (cart.length === 0) {
      setMessage("Your cart is empty.");
      return;
    }

    try {
      setPlacingOrder(true);
      setMessage("");

      const session =
        await getActiveTableSession();

      const orderSubtotal = cart.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      );

      const orderReference =
        generateOrderId();

      await addDoc(collection(db, "orders"), {
        orderId: orderReference,
        sessionId: session.id,

        tableId: tableCode,
        tableCode,

        items: cart.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total:
            item.price * item.quantity,
        })),

        note: orderNote.trim(),

        status: "pending",

        subtotal: orderSubtotal,
        serviceCharge: 0,
        tax: 0,
        total: orderSubtotal,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await updateDoc(
          doc(
            db,
            "tableSessions",
            session.id
          ),
          {
            updatedAt: serverTimestamp(),
          }
        );
      } catch (error) {
        console.error(
          "Session update error:",
          error
        );
      }

      setCart([]);
      setOrderNote("");
      setShowCart(false);

      setMessage(
        `Order ${orderReference} has been sent to the kitchen.`
      );
    } catch (error) {
      console.error("Order error:", error);

      setMessage(
        "Unable to place the order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  /* =========================================================
     CALL WAITER
     ========================================================= */

  async function callWaiter() {
    try {
      setCallingWaiter(true);
      setMessage("");

      const session =
        await getActiveTableSession();

      const existingCallQuery = query(
        collection(db, "waiterCalls"),
        where(
          "sessionId",
          "==",
          session.id
        ),
        where("status", "==", "pending"),
        limit(1)
      );

      const existingCallSnapshot =
        await getDocs(
          existingCallQuery
        );

      if (!existingCallSnapshot.empty) {
        setMessage(
          "A waiter has already been called for this table."
        );

        return;
      }

      await addDoc(
        collection(db, "waiterCalls"),
        {
          sessionId: session.id,

          tableId: tableCode,
          tableCode,

          status: "pending",

          createdAt: serverTimestamp(),

          acknowledgedBy: "",
        }
      );

      setMessage(
        "Waiter called. Someone will come to your table shortly."
      );
    } catch (error) {
      console.error(
        "Waiter call error:",
        error
      );

      setMessage(
        "Unable to call the waiter. Please try again."
      );
    } finally {
      setCallingWaiter(false);
    }
  }

  /* =========================================================
     GET BILL
     ========================================================= */

  async function getBill() {
    try {
      setGettingBill(true);
      setBillLoading(true);
      setMessage("");

      // Find an existing active session.
      // Do NOT create a new session just because
      // the customer pressed "Get Bill".
      const sessionQuery = query(
        collection(db, "tableSessions"),
        where(
          "tableCode",
          "==",
          tableCode
        ),
        where(
          "status",
          "==",
          "active"
        ),
        limit(1)
      );

      const sessionSnapshot =
        await getDocs(sessionQuery);

      if (sessionSnapshot.empty) {
        setBill(null);
        setShowBill(false);
        setMessage(
          "There is no active order for this table."
        );
        return;
      }

      const sessionDocument =
        sessionSnapshot.docs[0];

      const session = {
        id: sessionDocument.id,
        ...sessionDocument.data(),
      };

      setActiveSession(session);

      const ordersQuery = query(
        collection(db, "orders"),
        where(
          "sessionId",
          "==",
          session.id
        )
      );

      const ordersSnapshot =
        await getDocs(ordersQuery);

      const orderDetails =
        ordersSnapshot.docs
          .map((orderDocument) => ({
            id: orderDocument.id,
            ...orderDocument.data(),
          }))
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() ||
              0;

            const bTime =
              b.createdAt?.toMillis?.() ||
              0;

            return bTime - aTime;
          });

      // No orders means there is nothing to bill.
      if (orderDetails.length === 0) {
        setBill(null);
        setShowBill(false);
        setMessage(
          "There are no orders to bill for this table."
        );
        return;
      }

      const subtotal =
        orderDetails.reduce(
          (total, order) =>
            total +
            Number(order.subtotal || 0),
          0
        );

      const serviceCharge =
        orderDetails.reduce(
          (total, order) =>
            total +
            Number(
              order.serviceCharge || 0
            ),
          0
        );

      const tax =
        orderDetails.reduce(
          (total, order) =>
            total +
            Number(order.tax || 0),
          0
        );

      const total =
        orderDetails.reduce(
          (sum, order) =>
            sum +
            Number(order.total || 0),
          0
        );

      const billsQuery = query(
        collection(db, "bills"),
        where(
          "sessionId",
          "==",
          session.id
        ),
        limit(1)
      );

      const billsSnapshot =
        await getDocs(billsQuery);

      let billData;

      if (!billsSnapshot.empty) {
        const billDocument =
          billsSnapshot.docs[0];

        billData = {
          id: billDocument.id,
          ...billDocument.data(),
        };

        if (billData.status !== "paid") {
          await updateDoc(
            doc(
              db,
              "bills",
              billDocument.id
            ),
            {
              tableId: tableCode,
              tableCode,
              orderIds:
                orderDetails.map(
                  (order) => order.id
                ),
              subtotal,
              serviceCharge,
              tax,
              total,
              orderDetails,
              updatedAt:
                serverTimestamp(),
            }
          );

          billData = {
            ...billData,
            tableId: tableCode,
            tableCode,
            orderIds:
              orderDetails.map(
                (order) => order.id
              ),
            subtotal,
            serviceCharge,
            tax,
            total,
            orderDetails,
          };
        } else if (
          !billData.orderDetails ||
          billData.orderDetails.length === 0
        ) {
          billData.orderDetails =
            orderDetails;
        }
      } else {
        const billReference =
          await addDoc(
            collection(db, "bills"),
            {
              sessionId: session.id,
              tableId: tableCode,
              tableCode,
              orderIds:
                orderDetails.map(
                  (order) => order.id
                ),
              orderDetails,
              subtotal,
              serviceCharge,
              tax,
              total,
              paymentMethod: "",
              paymentStatus: "unpaid",
              status: "unpaid",
              createdAt:
                serverTimestamp(),
              updatedAt:
                serverTimestamp(),
            }
          );

        billData = {
          id: billReference.id,
          sessionId: session.id,
          tableId: tableCode,
          tableCode,
          orderIds:
            orderDetails.map(
              (order) => order.id
            ),
          orderDetails,
          subtotal,
          serviceCharge,
          tax,
          total,
          paymentMethod: "",
          paymentStatus: "unpaid",
          status: "unpaid",
        };
      }

      setBill(billData);
      setShowBill(true);
    } catch (error) {
      console.error("Bill error:", error);

      setMessage(
        "Unable to load the bill. Please try again."
      );
    } finally {
      setGettingBill(false);
      setBillLoading(false);
    }
  }

  /* =========================================================
     CASH BILL REQUEST
     ========================================================= */

  async function handleCashBillRequest() {
    if (!bill?.id) return;

    try {
      setMessage("");

      await updateDoc(
        doc(db, "bills", bill.id),
        {
          paymentMethod: "cash",
          paymentStatus:
            "awaiting_cash_collection",
          status: "unpaid",
          requestedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      await addDoc(
        collection(db, "billRequests"),
        {
          billId: bill.id,

          sessionId: bill.sessionId,

          tableId: tableCode,
          tableCode,

          paymentMethod: "cash",

          status: "pending",

          createdAt:
            serverTimestamp(),

          acknowledgedBy: "",
        }
      );

      setBill((currentBill) => ({
        ...currentBill,
        paymentMethod: "cash",
        paymentStatus:
          "awaiting_cash_collection",
        status: "unpaid",
      }));

      setMessage(
        "Bill Requested. A staff member will come to collect cash."
      );
    } catch (error) {
      console.error(
        "Cash bill request error:",
        error
      );

      setMessage(
        "Unable to request cash payment. Please try again."
      );
    }
  }

  /* =========================================================
     SELCOM PAYMENT
     ========================================================= */

  async function handleSelcomPayment() {
    if (!bill?.id) return;

    try {
      await updateDoc(
        doc(db, "bills", bill.id),
        {
          paymentMethod: "selcom_qr",
          paymentStatus:
            "awaiting_payment",
          status: "unpaid",
          updatedAt:
            serverTimestamp(),
        }
      );

      setBill((currentBill) => ({
        ...currentBill,
        paymentMethod: "selcom_qr",
        paymentStatus:
          "awaiting_payment",
        status: "unpaid",
      }));

      setSelcomOpen(true);
      setMessage("");
    } catch (error) {
      console.error(
        "Selcom payment error:",
        error
      );

      setMessage(
        "Unable to start Selcom payment. Please try again."
      );
    }
  }

  /* =========================================================
     COPY PAY BILL NUMBER
     ========================================================= */

  async function copyPayBillNumber() {
    try {
      await navigator.clipboard.writeText(
        payBillNumber
      );

      setSelcomCopied(true);

      setTimeout(() => {
        setSelcomCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      setMessage(
        "Unable to copy the Pay Bill number."
      );
    }
  }

  /* =========================================================
     SHARE TRANSACTION THROUGH WHATSAPP
     ========================================================= */

  async function shareSelcomTransaction() {
    if (!bill?.id) return;

    try {
      setSharingTransaction(true);

      await updateDoc(
        doc(db, "bills", bill.id),
        {
          paymentMethod: "selcom_qr",
          paymentStatus:
            "awaiting_verification",
          status: "unpaid",
          transactionSharedAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      await addDoc(
        collection(db, "billRequests"),
        {
          billId: bill.id,

          sessionId: bill.sessionId,

          tableId: tableCode,
          tableCode,

          paymentMethod: "selcom_qr",

          status:
            "pending_verification",

          createdAt:
            serverTimestamp(),

          acknowledgedBy: "",
        }
      );

      setBill((currentBill) => ({
        ...currentBill,
        paymentMethod: "selcom_qr",
        paymentStatus:
          "awaiting_verification",
        status: "unpaid",
      }));

      const whatsappMessage =
        `Soulmeats payment verification request.%0A%0A` +
        `Table: ${tableCode}%0A` +
        `Bill: ${bill.id}%0A` +
        `Session: ${bill.sessionId}%0A` +
        `Amount: ${formatMoney(
          bill.total
        )}%0A%0A` +
        `I have completed the Selcom payment. I will share the transaction confirmation here for verification.`;

      const whatsappUrl =
        `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

      window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
      );

      setMessage(
        "Payment submitted for verification. Please share your transaction confirmation on WhatsApp."
      );
    } catch (error) {
      console.error(
        "Transaction sharing error:",
        error
      );

      setMessage(
        "Unable to submit the payment for verification."
      );
    } finally {
      setSharingTransaction(false);
    }
  }

  /* =========================================================
     CLOSE BILL PANEL
     ========================================================= */

  function closeBill() {
    setShowBill(false);
    setSelcomOpen(false);
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loadingMenu) {
    return (
      <div className="loading-screen">
        <h2 className="brand loading-brand">
          S
          <span
            className="brand-fire"
            aria-hidden="true"
          >
            🔥
          </span>
          ulmeats
        </h2>

        <p>Open Air Restaurant</p>

        <span
          className="loading-spinner"
          aria-hidden="true"
        ></span>

        <p>Loading menu...</p>
      </div>
    );
  }

  /* =========================================================
     CUSTOMER UI
     ========================================================= */

  return (
    <div className="restaurant-app">
      <header className="restaurant-header">
        <div className="brand-block">
          <div className="brand">
            S
            <span className="brand-fire">
              🔥
            </span>
            ulmeats
          </div>

          <div className="restaurant-tagline">
            Open Air Restaurant
          </div>
        </div>

        <div className="table-badge">
          Table {tableCode}
        </div>
      </header>

      <main className="restaurant-content">
     
        {message && (
          <div className="message-box">
            {message}
          </div>
        )}

        {menuError && (
          <div className="error-box">
            {menuError}
          </div>
        )}

        <div className="search-container">
          <input
            className="menu-search"
            type="text"
            value={searchText}
            onChange={(event) =>
              setSearchText(
                event.target.value
              )
            }
            placeholder="Search menu..."
          />
        </div>

        <div className="category-list">
          <button
            className={
              selectedCategory === "all"
                ? "category-button active"
                : "category-button"
            }
            onClick={() =>
              setSelectedCategory("all")
            }
          >
            All
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              className={
                selectedCategory ===
                category.id
                  ? "category-button active"
                  : "category-button"
              }
              onClick={() =>
                setSelectedCategory(
                  category.id
                )
              }
            >
              {category.name}
            </button>
          ))}
        </div>

        <section className="menu-list">
          {filteredMenuItems.length === 0 ? (
            <div className="empty-menu">
              <h3>
                No menu items found
              </h3>

              <p>
                Try another search or
                category.
              </p>
            </div>
          ) : (
            filteredMenuItems.map((item) => {
              const quantity =
                getCartQuantity(item.id);

              const availability =
                getItemAvailability(item);
              const unavailable = !availability.available;

              return (
                <article
                  className="menu-item"
                  key={item.id}
                >
                  <div className="menu-item-content">
                    <div className="menu-item-info">
                      <h3>{item.name}</h3>

                      {item.description && (
                        <p>
                          {item.description}
                        </p>
                      )}

                      <div className="menu-item-category">
                        {getCategoryName(
                          item.categoryId
                        )}
                      </div>

                      <div
                        className={`menu-item-availability ${
                          availability.available
                            ? "available"
                            : "unavailable"
                        }`}
                      >
                        {availability.label}
                      </div>

                      <strong className="menu-item-price">
                        {formatMoney(
                          item.price
                        )}
                      </strong>
                    </div>

                    <div className="menu-item-action">
                      {unavailable ? (
                        <button
                          className="unavailable-button"
                          disabled
                        >
                          Unavailable
                        </button>
                      ) : quantity === 0 ? (
                        <button
                          className="add-button"
                          onClick={() =>
                            addToCart(item)
                          }
                        >
                          Add
                        </button>
                      ) : (
                        <div className="menu-quantity-control">
                          <button
                            onClick={() =>
                              decreaseQuantity(
                                item.id
                              )
                            }
                          >
                            −
                          </button>

                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(
                              event
                            ) => {
                              const raw =
                                event.target
                                  .value;

                              if (raw === "") {
                                return;
                              }

                              updateCartQuantity(
                                item.id,
                                raw
                              );
                            }}
                          />

                          <button
                            onClick={() =>
                              increaseQuantity(
                                item.id
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>

      {/* =====================================================
          BOTTOM ACTION BAR
          ===================================================== */}

      <div className="action-bar">
        <button
          onClick={() =>
            setShowCart(true)
          }
          className="action-button cart-action"
        >
          <span
            className="action-icon"
            aria-hidden="true"
          >
            🛒
          </span>

          <span>Cart</span>

          {cartCount > 0 && (
            <span className="cart-count">
              {cartCount}
            </span>
          )}
        </button>

        <button
          onClick={callWaiter}
          disabled={callingWaiter}
          className="action-button"
        >
          <span
            className="action-icon"
            aria-hidden="true"
          >
            🔔
          </span>

          <span>
            {callingWaiter
              ? "Calling..."
              : "Call Waiter"}
          </span>
        </button>

        <button
          onClick={getBill}
          disabled={gettingBill}
          className="action-button"
        >
          <span
            className="action-icon"
            aria-hidden="true"
          >
            🧾
          </span>

          <span>
            {gettingBill
              ? "Loading..."
              : "Get Bill"}
          </span>
        </button>
      </div>

      {/* =====================================================
          CART
          ===================================================== */}

      {showCart && (
        <div className="cart-overlay">
          <div className="cart-panel">
            <div className="cart-header">
              <div>
                <h2>Your Cart</h2>

                <p>
                  Table {tableCode}
                </p>
              </div>

              <button
                className="close-cart"
                onClick={() =>
                  setShowCart(false)
                }
              >
                ×
              </button>
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="empty-cart">
                  <h3>
                    Your cart is empty
                  </h3>

                  <p>
                    Add something delicious
                    from the menu.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    className="cart-item"
                    key={item.id}
                  >
                    <div className="cart-item-info">
                      <h3>{item.name}</h3>

                      <p>
                        {formatMoney(
                          item.price
                        )}{" "}
                        each
                      </p>
                    </div>

                    <div className="cart-item-right">
                      <div className="quantity-control">
                        <button
                          onClick={() =>
                            decreaseQuantity(
                              item.id
                            )
                          }
                        >
                          −
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={
                            item.quantity
                          }
                          onChange={(
                            event
                          ) => {
                            const raw =
                              event.target
                                .value;

                            if (raw === "") {
                              return;
                            }

                            updateCartQuantity(
                              item.id,
                              raw
                            );
                          }}
                        />

                        <button
                          onClick={() =>
                            increaseQuantity(
                              item.id
                            )
                          }
                        >
                          +
                        </button>
                      </div>

                      <strong>
                        {formatMoney(
                          item.price *
                            item.quantity
                        )}
                      </strong>

                      <button
                        className="remove-item"
                        onClick={() =>
                          removeFromCart(
                            item.id
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-summary">
                <div>
                  <span>Subtotal</span>

                  <strong>
                    {formatMoney(
                      cartSubtotal
                    )}
                  </strong>
                </div>

                <label className="order-note-field">
                  <span>Order note (optional)</span>
                  <textarea
                    value={orderNote}
                    onChange={(event) =>
                      setOrderNote(event.target.value)
                    }
                    placeholder="e.g. not spicy"
                    maxLength={300}
                  />
                </label>

                <button
                  className="place-order-button"
                  onClick={placeOrder}
                  disabled={placingOrder}
                >
                  {placingOrder
                    ? "Sending Order..."
                    : "Place Order"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          BILL
          ===================================================== */}

      {showBill && (
        <div className="bill-overlay">
          <div className="bill-panel">
            <div className="bill-content">
              <div className="bill-header">
                <div>
                  <h2>Your Bill</h2>

                  <p>
                    Table {tableCode}
                  </p>
                </div>

                <button
                  className="close-bill"
                  onClick={closeBill}
                >
                  ×
                </button>
              </div>

              {billLoading ? (
                <div className="bill-loading">
                  Loading bill...
                </div>
              ) : bill ? (
                <>
                  <div className="bill-status">
                    <span>Status</span>

                    <strong>
                      {bill.status === "paid"
                        ? "PAID"
                        : "UNPAID"}
                    </strong>
                  </div>

                  <div className="bill-orders">
                    <h3>Orders</h3>

                    {bill.orderDetails
                      ?.length > 0 ? (
                      bill.orderDetails.map(
                        (order) => (
                          <div
                            className="bill-order"
                            key={order.id}
                          >
                            <div className="bill-order-header">
                              <strong>
                                Order{" "}
                                {order.orderId}
                              </strong>

                              <span>
                                {formatDate(
                                  order.createdAt
                                )}
                              </span>
                            </div>

                            {order.note && (
                              <div className="bill-order-note">
                                Note: {order.note}
                              </div>
                            )}

                            {order.items?.map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  className="bill-item"
                                  key={`${order.id}-${item.menuItemId}-${index}`}
                                >
                                  <div className="bill-item-name">
                                    <strong>
                                      {item.name}
                                    </strong>

                                    <span>
                                      {
                                        item.quantity
                                      }{" "}
                                      ×{" "}
                                      {formatMoney(
                                        item.unitPrice
                                      )}
                                    </span>
                                  </div>

                                  <strong>
                                    {formatMoney(
                                      item.total
                                    )}
                                  </strong>
                                </div>
                              )
                            )}
                          </div>
                        )
                      )
                    ) : (
                      <div className="bill-no-items">
                        No orders found.
                      </div>
                    )}
                  </div>

                  <div className="bill-summary">
                    <div>
                      <span>
                        Subtotal
                      </span>

                      <strong>
                        {formatMoney(
                          bill.subtotal
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Service Charge
                      </span>

                      <strong>
                        {formatMoney(
                          bill.serviceCharge
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Tax</span>

                      <strong>
                        {formatMoney(
                          bill.tax
                        )}
                      </strong>
                    </div>

                    <div className="bill-total">
                      <span>Total</span>

                      <strong>
                        {formatMoney(
                          bill.total
                        )}
                      </strong>
                    </div>
                  </div>

                  {bill.status !== "paid" && (
                    <>
                      <div className="payment-section">
                        <h3>Payment</h3>

                        <p>
                          Choose how you would
                          like to pay.
                        </p>

                        <div className="payment-buttons">
                          <button
                            className="payment-button"
                            onClick={
                              handleCashBillRequest
                            }
                          >
                            💵 Pay Cash
                          </button>

                          <button
                            className="payment-button"
                            onClick={
                              handleSelcomPayment
                            }
                          >
                            📱 Selcom QR
                          </button>
                        </div>
                      </div>

                      {bill.paymentMethod ===
                        "cash" && (
                        <div className="payment-status-box">
                          <h3>
                            Bill Requested
                          </h3>

                          <p>
                            A staff member has
                            been notified and
                            will come to your
                            table to collect
                            cash.
                          </p>
                        </div>
                      )}

                      {bill.paymentMethod ===
                        "selcom_qr" &&
                        selcomOpen && (
                          <div className="selcom-section">
                            <h3>
                              Selcom Payment
                            </h3>

                            <p>
                              Scan the QR code
                              below to pay your
                              bill.
                            </p>

                            <div className="selcom-qr-box">
                              <img
                                src="./public/selcom_qr.jpg"
                                alt="Selcom Lipa Namba QR Code"
                              />
                            </div>

                            <div className="paybill-box">
                              <span>
                                Pay Bill Number
                              </span>

                              <strong>
                                {payBillNumber}
                              </strong>

                              <button
                                onClick={
                                  copyPayBillNumber
                                }
                              >
                                {selcomCopied
                                  ? "Copied!"
                                  : "Copy Number"}
                              </button>
                            </div>

                            <div className="selcom-instructions">
                              <p>
                                After making the
                                payment, share
                                your transaction
                                confirmation
                                with us for
                                verification.
                              </p>
                            </div>

                            <button
                              className="whatsapp-button"
                              onClick={
                                shareSelcomTransaction
                              }
                              disabled={
                                sharingTransaction
                              }
                            >
                              {sharingTransaction
                                ? "Submitting..."
                                : "Share Transaction on WhatsApp"}
                            </button>

                            {bill.paymentStatus ===
                              "awaiting_verification" && (
                              <div className="payment-status-box">
                                <h3>
                                  Payment
                                  Awaiting
                                  Verification
                                </h3>

                                <p>
                                  Your payment
                                  information
                                  has been
                                  submitted.
                                  Staff will
                                  verify the
                                  payment and
                                  mark the bill
                                  as paid.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                    </>
                  )}

                  {bill.status === "paid" && (
                    <div className="payment-status-box paid">
                      <h3>
                        Payment Complete
                      </h3>

                      <p>
                        Thank you. Your bill
                        has been paid.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bill-no-items">
                  Unable to load bill.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

