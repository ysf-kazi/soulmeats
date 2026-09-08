import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export default function StaffSessions() {
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [view, setView] = useState("active");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "tableSessions"),
      (snapshot) => {
        setSessions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      () => setError("Unable to load sessions.")
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      () => setError("Unable to load orders.")
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const paidBillsQuery = query(collection(db, "bills"), where("status", "==", "paid"));
    const unsubscribe = onSnapshot(
      paidBillsQuery,
      (snapshot) => {
        setBills(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      () => setError("Unable to load payment reports.")
    );
    return () => unsubscribe();
  }, []);

  const activeSessions = useMemo(
    () => sessions.filter((session) => session.status === "active"),
    [sessions]
  );

  const openTableData = useMemo(() => {
    return activeSessions
      .map((session) => ({
        ...session,
        orders: orders
          .filter((order) => order.sessionId === session.id && order.status !== "completed" && order.status !== "cancelled")
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)),
      }))
      .sort((a, b) => (a.tableCode || "").localeCompare(b.tableCode || ""));
  }, [activeSessions, orders]);

  const reportTotal = bills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
  const reportOrders = orders.filter((order) => order.status === "completed").length;
  const todayKey = new Date().toDateString();
  const todayPaidBills = bills.filter((bill) => {
    const value = bill.paidAt || bill.createdAt;
    if (!value) return false;
    try {
      const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
      return date.toDateString() === todayKey;
    } catch {
      return false;
    }
  });
  const todayRevenue = todayPaidBills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);

  function formatMoney(amount) {
    return `Tzs ${Number(amount || 0).toLocaleString()}`;
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
      return date.toLocaleString();
    } catch {
      return "";
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case "pending": return "Pending";
      case "preparing": return "Preparing";
      case "ready": return "Ready";
      case "completed": return "Completed";
      default: return status || "Unknown";
    }
  }

  return (
    <div className="staff-dashboard">
      <header className="staff-dashboard-header">
        <div className="staff-brand">
          <div className="staff-brand-logo">S🔥</div>
          <div>
            <h1>Soulmeats</h1>
            <p>Open Air Restaurant</p>
          </div>
        </div>
        <a className="staff-back-button" href="/staff">← Dashboard</a>
      </header>

      <main className="staff-dashboard-content">
        <section className="staff-welcome-card">
          <div>
            <span className="staff-eyebrow">TABLES & REPORTS</span>
            <h2>Sessions & Reports</h2>
            <p>See which tables are open, what they have ordered, and restaurant payment totals.</p>
          </div>
        </section>

        {error && <div className="staff-error"><strong>Something went wrong</strong><span>{error}</span></div>}

        <div className="staff-page-tabs">
          <button className={view === "active" ? "staff-page-tab active" : "staff-page-tab"} onClick={() => setView("active")}>Active Tables ({activeSessions.length})</button>
          <button className={view === "all" ? "staff-page-tab active" : "staff-page-tab"} onClick={() => setView("all")}>All Sessions ({sessions.length})</button>
          <button className={view === "reports" ? "staff-page-tab active" : "staff-page-tab"} onClick={() => setView("reports")}>Reports</button>
        </div>

        {view === "reports" ? (
          <section className="staff-report-grid">
            <div className="staff-report-card"><span>Paid Bills (All Time)</span><strong>{bills.length}</strong></div>
            <div className="staff-report-card"><span>Paid Revenue (All Time)</span><strong>{formatMoney(reportTotal)}</strong></div>
            <div className="staff-report-card"><span>Paid Bills Today</span><strong>{todayPaidBills.length}</strong></div>
            <div className="staff-report-card"><span>Revenue Today</span><strong>{formatMoney(todayRevenue)}</strong></div>
            <div className="staff-report-card"><span>Completed Orders</span><strong>{reportOrders}</strong></div>
            <div className="staff-report-card"><span>Active Tables</span><strong>{activeSessions.length}</strong></div>
          </section>
        ) : view === "all" ? (
          <section className="staff-orders-section">
            <div className="staff-section-header"><div><span className="staff-section-kicker">SESSIONS</span><h2>All Sessions</h2><p>Every table visit currently stored in the system.</p></div><span className="staff-order-count">{sessions.length}</span></div>
            <div className="staff-session-list">
              {[...sessions].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).map((session) => {
                const sessionOrders = orders.filter((order) => order.sessionId === session.id);
                return <article className="staff-session-card" key={session.id}>
                  <div><strong>Table {session.tableCode}</strong><span>{session.status === "active" ? "ACTIVE" : "CLOSED"}</span></div>
                  <p>Opened: {formatDate(session.createdAt)}</p>
                  <p>Orders: {sessionOrders.length}</p>
                  {session.closedAt && <p>Closed: {formatDate(session.closedAt)}</p>}
                </article>;
              })}
            </div>
          </section>
        ) : (
          <section className="staff-orders-section">
            <div className="staff-section-header"><div><span className="staff-section-kicker">OPEN TABLES</span><h2>Active Tables</h2><p>Each active table and the orders still open on that session.</p></div><span className="staff-order-count">{activeSessions.length}</span></div>
            {openTableData.length === 0 ? <div className="staff-empty-card"><div className="staff-empty-icon">✓</div><h3>No active tables</h3><p>Tables will appear here when customers place orders.</p></div> : <div className="staff-session-list">
              {openTableData.map((session) => <article className="staff-session-card staff-open-table-card" key={session.id}>
                <div className="staff-session-card-header"><div><span className="staff-card-label">OPEN TABLE</span><h3>Table {session.tableCode}</h3></div><strong>{session.orders.length} order{session.orders.length === 1 ? "" : "s"}</strong></div>
                <p>Session opened {formatDate(session.createdAt)}</p>
                {session.orders.length === 0 ? <div className="staff-session-empty">No open orders yet.</div> : session.orders.map((order) => <div className="staff-open-order" key={order.id}>
                  <div><strong>Order {order.orderId}</strong><span className={`staff-order-status staff-status-${order.status}`}>{getStatusLabel(order.status)}</span></div>
                  <p>{order.items?.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</p>
                  {order.note && <div className="staff-order-note">Note: {order.note}</div>}
                  <strong>{formatMoney(order.total)}</strong>
                </div>)}
              </article>)}
            </div>}
          </section>
        )}
      </main>
    </div>
  );
}
