import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

import { db, auth } from "./firebase";

export default function StaffDashboard({ user }) {
  const [orders, setOrders] = useState([]);
  const [waiterCalls, setWaiterCalls] = useState([]);
  const [billRequests, setBillRequests] = useState([]);
  const [activeTables, setActiveTables] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [soundEnabled, setSoundEnabled] = useState(false);

  const knownOrderIds = useRef(new Set());
  const knownWaiterCallIds = useRef(new Set());

  const audioContextRef = useRef(null);
  const soundEnabledRef = useRef(false);

  function getAudioContext() {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return null;
      }

      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  }

  async function enableSound() {
    const context = getAudioContext();

    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);

    playAlert("order");
  }

  function playAlert(type) {
    const context = getAudioContext();

    if (!context || !soundEnabledRef.current) {
      return;
    }

    const now = context.currentTime;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
      type === "waiter" ? 520 : 760,
      now
    );

    oscillator.frequency.setValueAtTime(
      type === "waiter" ? 390 : 620,
      now + 0.14
    );

    gain.gain.setValueAtTime(0.0001, now);

    gain.gain.exponentialRampToValueAtTime(
      0.22,
      now + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.32
    );

    oscillator.start(now);
    oscillator.stop(now + 0.34);
  }

  /* =========================================================
     LIVE ORDERS
     ========================================================= */

  useEffect(() => {
    const ordersQuery = query(
      collection(db, "orders"),
      where("status", "in", [
        "pending",
        "preparing",
        "ready",
      ])
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orderData = snapshot.docs
          .map((orderDocument) => ({
            id: orderDocument.id,
            ...orderDocument.data(),
          }))
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() || 0;

            const bTime =
              b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
          });

        const newPendingOrder = orderData.some(
          (order) =>
            order.status === "pending" &&
            !knownOrderIds.current.has(order.id)
        );

        if (
          knownOrderIds.current.size > 0 &&
          newPendingOrder
        ) {
          playAlert("order");
        }

        knownOrderIds.current = new Set(
          orderData.map((order) => order.id)
        );

        setOrders(orderData);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Orders listener error:",
          snapshotError
        );

        setError("Unable to load live orders.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     WAITER CALLS
     ========================================================= */

  useEffect(() => {
    const waiterCallsQuery = query(
      collection(db, "waiterCalls"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      waiterCallsQuery,
      (snapshot) => {
        const callData = snapshot.docs
          .map((callDocument) => ({
            id: callDocument.id,
            ...callDocument.data(),
          }))
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() || 0;

            const bTime =
              b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
          });

        const newWaiterCall = callData.some(
          (call) =>
            !knownWaiterCallIds.current.has(call.id)
        );

        if (
          knownWaiterCallIds.current.size > 0 &&
          newWaiterCall
        ) {
          playAlert("waiter");
        }

        knownWaiterCallIds.current = new Set(
          callData.map((call) => call.id)
        );

        setWaiterCalls(callData);
      },
      (snapshotError) => {
        console.error(
          "Waiter calls listener error:",
          snapshotError
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     BILL REQUESTS
     ========================================================= */

  useEffect(() => {
    const billsQuery = query(
      collection(db, "bills"),
      where("status", "==", "unpaid")
    );

    const unsubscribe = onSnapshot(
      billsQuery,
      (snapshot) => {
        const billData = snapshot.docs
          .map((billDocument) => ({
            id: billDocument.id,
            ...billDocument.data(),
          }))
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() || 0;

            const bTime =
              b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
          });

        setBillRequests(billData);
      },
      (snapshotError) => {
        console.error(
          "Bills listener error:",
          snapshotError
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     ACTIVE TABLES
     ========================================================= */

  useEffect(() => {
    const activeSessionsQuery = query(
      collection(db, "tableSessions"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(
      activeSessionsQuery,
      (snapshot) => {
        setActiveTables(snapshot.size);
      },
      (snapshotError) => {
        console.error(
          "Active sessions listener error:",
          snapshotError
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     ORDER STATUS
     ========================================================= */

  async function updateOrderStatus(
    orderId,
    newStatus
  ) {
    try {
      setError("");

      await updateDoc(
        doc(db, "orders", orderId),
        {
          status: newStatus,
          updatedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(
        "Order status update error:",
        error
      );

      setError(
        "Unable to update the order."
      );
    }
  }

  /* =========================================================
     WAITER CALL ACKNOWLEDGEMENT
     ========================================================= */

  async function acknowledgeWaiterCall(callId) {
    try {
      setError("");

      await updateDoc(
        doc(db, "waiterCalls", callId),
        {
          status: "acknowledged",
          acknowledgedBy: user?.uid || "",
          acknowledgedAt: new Date(),
        }
      );
    } catch (error) {
      console.error(
        "Waiter call acknowledgement error:",
        error
      );

      setError(
        "Unable to acknowledge the waiter call."
      );
    }
  }

  /* =========================================================
     BILL PAYMENT VERIFICATION
     ========================================================= */

  async function verifyBillPayment(
    billId,
    paymentMethod
  ) {
    try {
      setError("");

      const billDocument = doc(
        db,
        "bills",
        billId
      );

      const billData = billRequests.find(
        (bill) => bill.id === billId
      );

      if (!billData?.sessionId) {
        setError(
          "This bill does not have a session ID."
        );

        return;
      }

      const sessionDocument = doc(
        db,
        "tableSessions",
        billData.sessionId
      );

      const batch = writeBatch(db);

      batch.update(billDocument, {
        paymentMethod,
        paymentStatus: "paid",
        status: "paid",
        paidAt: new Date(),
        paidBy: user?.uid || "",
      });

      batch.update(sessionDocument, {
        status: "closed",
        closedAt: new Date(),
        closedBy: user?.uid || "",
      });

      await batch.commit();
    } catch (error) {
      console.error(
        "Bill payment verification error:",
        error
      );

      setError(
        "Unable to verify the payment."
      );
    }
  }

  /* =========================================================
     LOGOUT
     ========================================================= */

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function formatMoney(amount) {
    return `Tzs ${Number(
      amount || 0
    ).toLocaleString()}`;
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

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

  function getStatusLabel(status) {
    switch (status) {
      case "pending":
        return "Pending";

      case "preparing":
        return "Preparing";

      case "ready":
        return "Ready";

      case "completed":
        return "Completed";

      case "cancelled":
        return "Cancelled";

      default:
        return status;
    }
  }

  function getPaymentMethodLabel(
    paymentMethod
  ) {
    switch (paymentMethod) {
      case "cash":
        return "Cash";

      case "selcom_qr":
        return "Selcom QR";

      default:
        return "Not selected";
    }
  }

  /* =========================================================
     STATISTICS
     ========================================================= */

  const pendingOrders = orders.filter(
    (order) =>
      order.status === "pending"
  ).length;

  const preparingOrders = orders.filter(
    (order) =>
      order.status === "preparing"
  ).length;

  const readyOrders = orders.filter(
    (order) =>
      order.status === "ready"
  ).length;

  /* =========================================================
     DASHBOARD
     ========================================================= */

  return (
    <div className="staff-dashboard">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="staff-dashboard-header">

        <div className="staff-brand">

          <div className="staff-brand-logo">
            S🔥
          </div>

          <div>
            <h1>Soulmeats</h1>
            <p>Open Air Restaurant</p>
          </div>

        </div>

        <div className="staff-header-right">

          <div className="staff-user-info">
            <strong>Admin</strong>
            <span>{user?.email}</span>
          </div>

          <div className="staff-header-nav">

            <a href="/staff/sessions">
              Sessions & Reports
            </a>

            <a href="/staff/menu">
              Item Management
            </a>

            <button
              className={
                soundEnabled
                  ? "staff-sound-button enabled"
                  : "staff-sound-button"
              }
              onClick={enableSound}
            >
              {soundEnabled
                ? "🔊 Sound On"
                : "🔔 Enable Sound"}
            </button>

          </div>

          <button
            className="staff-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>

      <main className="staff-dashboard-content">

        {/* ===================================================
            WELCOME
            =================================================== */}

        <section className="staff-welcome-card">

          <div>

            <span className="staff-eyebrow">
              RESTAURANT CONTROL
            </span>

            <h2>
              Welcome back, Admin
            </h2>

            <p>
              Monitor customer orders, waiter
              calls and payments from one place.
            </p>

          </div>

          <div className="staff-live-indicator">
            <span></span>
            Live
          </div>

        </section>

        {/* ===================================================
            ERROR
            =================================================== */}

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
            STATISTICS
            =================================================== */}

        <section className="staff-stats-grid">

          <div className="staff-stat-card staff-stat-orders">

            <div className="staff-stat-icon">
              🍽️
            </div>

            <div>
              <span>New Orders</span>

              <strong>
                {pendingOrders}
              </strong>

              <small>
                Waiting for staff
              </small>
            </div>

          </div>

          <div className="staff-stat-card">

            <div className="staff-stat-icon">
              👨‍🍳
            </div>

            <div>
              <span>Preparing</span>

              <strong>
                {preparingOrders}
              </strong>

              <small>
                In the kitchen
              </small>
            </div>

          </div>

          <div className="staff-stat-card">

            <div className="staff-stat-icon">
              🔔
            </div>

            <div>
              <span>Waiter Calls</span>

              <strong>
                {waiterCalls.length}
              </strong>

              <small>
                Need assistance
              </small>
            </div>

          </div>

          <div className="staff-stat-card">

            <div className="staff-stat-icon">
              💳
            </div>

            <div>
              <span>Bill Requests</span>

              <strong>
                {billRequests.length}
              </strong>

              <small>
                Awaiting payment
              </small>
            </div>

          </div>

          <div className="staff-stat-card">

            <div className="staff-stat-icon">
              🪑
            </div>

            <div>
              <span>Active Tables</span>

              <strong>
                {activeTables}
              </strong>

              <small>
                Active sessions
              </small>
            </div>

          </div>

          <div className="staff-stat-card">

            <div className="staff-stat-icon">
              ✅
            </div>

            <div>
              <span>Ready Orders</span>

              <strong>
                {readyOrders}
              </strong>

              <small>
                Ready for customers
              </small>
            </div>

          </div>

        </section>

        {/* ===================================================
            WAITER CALLS
            =================================================== */}

        <section className="staff-orders-section">

          <div className="staff-section-header">

            <div>

              <span className="staff-section-kicker">
                CUSTOMER SERVICE
              </span>

              <h2>
                Waiter Calls
              </h2>

              <p>
                Tables currently requesting
                assistance.
              </p>

            </div>

            <span className="staff-order-count">
              {waiterCalls.length}
            </span>

          </div>

          {waiterCalls.length === 0 ? (

            <div className="staff-empty-card">

              <div className="staff-empty-icon">
                ✓
              </div>

              <h3>
                No pending waiter calls
              </h3>

              <p>
                New customer calls will appear
                here automatically.
              </p>

            </div>

          ) : (

            <div className="staff-orders-list">

              {waiterCalls.map((call) => (

                <article
                  className="staff-order-card staff-waiter-card"
                  key={call.id}
                >

                  <div className="staff-order-header">

                    <div>

                      <span className="staff-card-label">
                        WAITER REQUEST
                      </span>

                      <h3>
                        Table {call.tableCode}
                      </h3>

                      <p>
                        Customer is requesting
                        a waiter.
                      </p>

                    </div>

                    <div className="staff-order-status staff-status-pending">
                      Pending
                    </div>

                  </div>

                  <div className="staff-order-time">
                    🕐 {formatDate(call.createdAt)}
                  </div>

                  <div className="staff-order-actions">

                    <button
                      className="staff-primary-action"
                      onClick={() =>
                        acknowledgeWaiterCall(
                          call.id
                        )
                      }
                    >
                      Acknowledge Call
                    </button>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

        {/* ===================================================
            BILL REQUESTS
            =================================================== */}

        <section className="staff-orders-section">

          <div className="staff-section-header">

            <div>

              <span className="staff-section-kicker">
                PAYMENTS
              </span>

              <h2>
                Bill Requests
              </h2>

              <p>
                Unpaid bills waiting for payment
                verification.
              </p>

            </div>

            <span className="staff-order-count">
              {billRequests.length}
            </span>

          </div>

          {billRequests.length === 0 ? (

            <div className="staff-empty-card">

              <div className="staff-empty-icon">
                ✓
              </div>

              <h3>
                No unpaid bills
              </h3>

              <p>
                Customer bill requests will
                appear here automatically.
              </p>

            </div>

          ) : (

            <div className="staff-orders-list">

              {billRequests.map((bill) => (

                <article
                  className="staff-order-card staff-bill-card"
                  key={bill.id}
                >

                  <div className="staff-order-header">

                    <div>

                      <span className="staff-card-label">
                        PAYMENT REQUEST
                      </span>

                      <h3>
                        Table {bill.tableCode}
                      </h3>

                      <p>
                        Bill waiting for
                        verification.
                      </p>

                    </div>

                    <div className="staff-order-status staff-status-unpaid">
                      UNPAID
                    </div>

                  </div>

                  <div className="staff-order-time">
                    🕐 {formatDate(bill.createdAt)}
                  </div>

                  <div className="staff-bill-breakdown">

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

                      <span>
                        Tax
                      </span>

                      <strong>
                        {formatMoney(
                          bill.tax
                        )}
                      </strong>

                    </div>

                  </div>

                  <div className="staff-order-total">

                    <span>
                      Total
                    </span>

                    <strong>
                      {formatMoney(
                        bill.total
                      )}
                    </strong>

                  </div>

                  <div className="staff-payment-method">

                    <span>
                      Customer selected:
                    </span>

                    <strong>
                      {getPaymentMethodLabel(
                        bill.paymentMethod
                      )}
                    </strong>

                  </div>

                  <div className="staff-payment-actions">

                    <button
                      className="staff-cash-button"
                      onClick={() =>
                        verifyBillPayment(
                          bill.id,
                          "cash"
                        )
                      }
                    >
                      ✓ Verify Cash
                    </button>

                    <button
                      className="staff-selcom-button"
                      onClick={() =>
                        verifyBillPayment(
                          bill.id,
                          "selcom_qr"
                        )
                      }
                    >
                      ✓ Verify Selcom
                    </button>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

        {/* ===================================================
            CURRENT ORDERS
            =================================================== */}

        <section className="staff-orders-section">

          <div className="staff-section-header">

            <div>

              <span className="staff-section-kicker">
                KITCHEN
              </span>

              <h2>
                Current Orders
              </h2>

              <p>
                Live customer orders from the
                restaurant.
              </p>

            </div>

            <span className="staff-order-count">
              {orders.length}
            </span>

          </div>

          {loading ? (

            <div className="staff-empty-card">

              <div className="staff-spinner staff-spinner-dark"></div>

              <h3>
                Loading orders...
              </h3>

              <p>
                Connecting to live restaurant
                orders.
              </p>

            </div>

          ) : orders.length === 0 ? (

            <div className="staff-empty-card">

              <div className="staff-empty-icon">
                ✓
              </div>

              <h3>
                No current orders
              </h3>

              <p>
                New customer orders will appear
                here automatically.
              </p>

            </div>

          ) : (

            <div className="staff-orders-list">

              {orders.map((order) => (

                <article
                  className="staff-order-card"
                  key={order.id}
                >

                  {/* ORDER HEADER */}

                  <div className="staff-order-header">

                    <div>

                      <span className="staff-card-label">
                        CUSTOMER ORDER
                      </span>

                      <h3>
                        Order {order.orderId}
                      </h3>

                      <p>
                        Table {order.tableCode}
                      </p>

                    </div>

                    <div
                      className={`staff-order-status staff-status-${order.status}`}
                    >
                      {getStatusLabel(
                        order.status
                      )}
                    </div>

                  </div>

                  {/* ORDER TIME */}

                  <div className="staff-order-time">
                    🕐 {formatDate(order.createdAt)}
                  </div>

                  {/* CUSTOMER NOTE */}

                  {order.note && (
                    <div className="staff-order-note">
                      <strong>
                        Customer note
                      </strong>

                      <span>
                        {order.note}
                      </span>
                    </div>
                  )}

                  {/* ORDER ITEMS */}

                  <div className="staff-order-items">

                    {order.items?.map(
                      (item, index) => (

                        <div
                          className="staff-order-item"
                          key={`${order.id}-${index}`}
                        >

                          <div>

                            <strong>
                              {item.name}
                            </strong>

                            <span>
                              × {item.quantity}
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

                  {/* ORDER TOTAL */}

                  <div className="staff-order-total">

                    <span>
                      Total
                    </span>

                    <strong>
                      {formatMoney(
                        order.total
                      )}
                    </strong>

                  </div>

                  {/* ORDER ACTIONS */}

                  <div className="staff-order-actions">

                    {order.status ===
                      "pending" && (

                      <button
                        className="staff-primary-action"
                        onClick={() =>
                          updateOrderStatus(
                            order.id,
                            "preparing"
                          )
                        }
                      >
                        Start Preparing
                      </button>

                    )}

                    {order.status ===
                      "preparing" && (

                      <button
                        className="staff-primary-action"
                        onClick={() =>
                          updateOrderStatus(
                            order.id,
                            "ready"
                          )
                        }
                      >
                        Mark Ready
                      </button>

                    )}

                    {order.status ===
                      "ready" && (

                      <button
                        className="staff-primary-action"
                        onClick={() =>
                          updateOrderStatus(
                            order.id,
                            "completed"
                          )
                        }
                      >
                        Complete Order
                      </button>

                    )}

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}