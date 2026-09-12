import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "./firebase";

export default function StaffSessions({ user }) {
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [view, setView] = useState("active");
  const [selectedSessionId, setSelectedSessionId] =
    useState(null);
  const [error, setError] = useState("");
  const [closingId, setClosingId] = useState(null);

  /* =========================================================
     LOAD SESSIONS
     ========================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "tableSessions"),
      (snapshot) => {
        setSessions(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (snapshotError) => {
        console.error(
          "Sessions listener error:",
          snapshotError
        );

        setError("Unable to load sessions.");
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     LOAD ORDERS
     ========================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        setOrders(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (snapshotError) => {
        console.error(
          "Orders listener error:",
          snapshotError
        );

        setError("Unable to load orders.");
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     LOAD ALL BILLS
     ========================================================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "bills"),
      (snapshot) => {
        setBills(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (snapshotError) => {
        console.error(
          "Bills listener error:",
          snapshotError
        );

        setError("Unable to load payment information.");
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     ACTIVE SESSIONS
     ========================================================= */

  const activeSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status === "active"
      ),
    [sessions]
  );

  /* =========================================================
     ACTIVE TABLE SUMMARY
     ========================================================= */

const openTableData = useMemo(() => {
  return activeSessions
    .map((session) => {
      const sessionOrders = orders
        .filter(
          (order) =>
            order.sessionId === session.id
        )
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() || 0) -
            (a.createdAt?.toMillis?.() || 0)
        );

      return {
        ...session,
        orders: sessionOrders,
      };
    })
    .sort((a, b) =>
      (a.tableCode || "").localeCompare(
        b.tableCode || ""
      )
    );
}, [activeSessions, orders]);

  /* =========================================================
     SELECTED SESSION
     ========================================================= */

  const selectedSession = useMemo(
    () =>
      sessions.find(
        (session) =>
          session.id === selectedSessionId
      ) || null,
    [sessions, selectedSessionId]
  );

  const selectedSessionOrders = useMemo(() => {
    if (!selectedSession) return [];

    return orders
      .filter(
        (order) =>
          order.sessionId ===
          selectedSession.id
      )
      .sort(
        (a, b) =>
          (a.createdAt?.toMillis?.() || 0) -
          (b.createdAt?.toMillis?.() || 0)
      );
  }, [selectedSession, orders]);

  const selectedSessionBills = useMemo(() => {
    if (!selectedSession) return [];

    return bills
      .filter(
        (bill) =>
          bill.sessionId ===
          selectedSession.id
      )
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() || 0) -
          (a.createdAt?.toMillis?.() || 0)
      );
  }, [selectedSession, bills]);

  /* =========================================================
     SESSION TOTALS
     ========================================================= */

  function getOrderTotal(sessionOrders) {
    return sessionOrders.reduce(
      (sum, order) => {
        if (order.status === "cancelled") {
          return sum;
        }

        return (
          sum + Number(order.total || 0)
        );
      },
      0
    );
  }

  function getSessionBillTotal(
    session,
    sessionOrders,
    sessionBills
  ) {
    const latestBill =
      sessionBills[0];

    if (latestBill) {
      return Number(
        latestBill.total || 0
      );
    }

    return getOrderTotal(
      sessionOrders
    );
  }

  /* =========================================================
     REPORT TOTALS
     ========================================================= */

  const paidBills = bills.filter(
    (bill) =>
      bill.status === "paid"
  );

  const reportTotal = paidBills.reduce(
    (sum, bill) =>
      sum + Number(bill.total || 0),
    0
  );

  const reportOrders = orders.filter(
    (order) =>
      order.status === "completed"
  ).length;

  const todayKey =
    new Date().toDateString();

  const todayPaidBills =
    paidBills.filter((bill) => {
      const value =
        bill.paidAt ||
        bill.createdAt;

      if (!value) return false;

      try {
        const date =
          typeof value.toDate ===
          "function"
            ? value.toDate()
            : new Date(value);

        return (
          date.toDateString() ===
          todayKey
        );
      } catch {
        return false;
      }
    });

  const todayRevenue =
    todayPaidBills.reduce(
      (sum, bill) =>
        sum +
        Number(bill.total || 0),
      0
    );

  const openSessionValue =
    activeSessions.reduce(
      (sum, session) => {
        const sessionOrders =
          orders.filter(
            (order) =>
              order.sessionId ===
              session.id
          );

        const sessionBills =
          bills.filter(
            (bill) =>
              bill.sessionId ===
              session.id
          );

        return (
          sum +
          getSessionBillTotal(
            session,
            sessionOrders,
            sessionBills
          )
        );
      },
      0
    );

  /* =========================================================
     HELPERS
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
        typeof value.toDate ===
        "function"
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
        return status || "Unknown";
    }
  }

  function getBillStatusLabel(status) {
    switch (status) {
      case "paid":
        return "PAID";

      case "unpaid":
        return "UNPAID";

      default:
        return status
          ? status.toUpperCase()
          : "UNKNOWN";
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
        return (
          paymentMethod || "Not selected"
        );
    }
  }

  /* =========================================================
     VIEW SESSION DETAILS
     ========================================================= */

  function viewSession(sessionId) {
    setSelectedSessionId(
      sessionId
    );

    setTimeout(() => {
      document
        .getElementById(
          "session-details"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  /* =========================================================
     FORCE CLOSE SESSION
     ========================================================= */

  async function forceCloseSession(
    session
  ) {
    const sessionOrders =
      orders.filter(
        (order) =>
          order.sessionId ===
          session.id
      );

    const sessionBills =
      bills.filter(
        (bill) =>
          bill.sessionId ===
          session.id
      );

    const unpaidBill =
      sessionBills.find(
        (bill) =>
          bill.status !== "paid"
      );

    const total =
      getSessionBillTotal(
        session,
        sessionOrders,
        sessionBills
      );

    if (unpaidBill) {
      const continueClose =
        window.confirm(
          `This table still has an unpaid bill of ${formatMoney(
            total
          )}.\n\nForce closing the session will NOT mark the bill as paid.\n\nDo you want to continue?`
        );

      if (!continueClose) {
        return;
      }
    }

    const reason =
      window.prompt(
        `Why are you force closing Table ${session.tableCode}?\n\nExample: Customer left without payment, duplicate session, test order, etc.`
      );

    if (!reason || !reason.trim()) {
      return;
    }

    const confirmed =
      window.confirm(
        `Force close Table ${session.tableCode}?\n\nReason: ${reason.trim()}`
      );

    if (!confirmed) {
      return;
    }

    try {
      setClosingId(session.id);
      setError("");

      const currentUser =
        user ||
        auth.currentUser;

      await updateDoc(
        doc(
          db,
          "tableSessions",
          session.id
        ),
        {
          status: "closed",
          closedAt: new Date(),
          closedBy:
            currentUser?.uid || "",
          closeReason:
            reason.trim(),
          updatedAt: new Date(),
        }
      );

      setSelectedSessionId(null);
    } catch (error) {
      console.error(
        "Force close error:",
        error
      );

      setError(
        "Unable to close the session."
      );
    } finally {
      setClosingId(null);
    }
  }

  /* =========================================================
     SESSION DETAIL COMPONENT
     ========================================================= */

  function renderSessionDetails(
    session
  ) {
    if (!session) return null;

    const sessionOrders =
      orders
        .filter(
          (order) =>
            order.sessionId ===
            session.id
        )
        .sort(
          (a, b) =>
            (a.createdAt?.toMillis?.() ||
              0) -
            (b.createdAt?.toMillis?.() ||
              0)
        );

    const sessionBills =
      bills.filter(
        (bill) =>
          bill.sessionId ===
          session.id
      );

    const orderTotal =
      getOrderTotal(
        sessionOrders
      );

    const sessionTotal =
      getSessionBillTotal(
        session,
        sessionOrders,
        sessionBills
      );

    return (
      <section
        id="session-details"
        className="staff-orders-section"
      >
        <div className="staff-section-header">

          <div>

            <span className="staff-section-kicker">
              SESSION DETAILS
            </span>

            <h2>
              Table {session.tableCode}
            </h2>

            <p>
              Full history for this
              table session.
            </p>

          </div>

          <button
            className="staff-secondary-action"
            onClick={() =>
              setSelectedSessionId(
                null
              )
            }
          >
            Close Details
          </button>

        </div>

        <div className="staff-session-list">

          <article className="staff-session-card">

            <div className="staff-session-card-header">

              <div>

                <span className="staff-card-label">
                  {session.status ===
                  "active"
                    ? "ACTIVE SESSION"
                    : "CLOSED SESSION"}
                </span>

                <h3>
                  Table{" "}
                  {session.tableCode}
                </h3>

              </div>

              <strong>
                {formatMoney(
                  sessionTotal
                )}
              </strong>

            </div>

            <p>
              Session ID:{" "}
              {session.id}
            </p>

            <p>
              Opened:{" "}
              {formatDate(
                session.createdAt
              )}
            </p>

            {session.closedAt && (
              <p>
                Closed:{" "}
                {formatDate(
                  session.closedAt
                )}
              </p>
            )}

            {session.closeReason && (
              <p>
                Close reason:{" "}
                {session.closeReason}
              </p>
            )}

          </article>

          <article className="staff-session-card">

            <div className="staff-section-header">

              <div>

                <span className="staff-section-kicker">
                  ORDERS
                </span>

                <h2>
                  All Orders
                </h2>

                <p>
                  Every order belonging
                  to this session.
                </p>

              </div>

              <span className="staff-order-count">
                {sessionOrders.length}
              </span>

            </div>

            {sessionOrders.length ===
            0 ? (

              <div className="staff-session-empty">
                No orders found for
                this session.
              </div>

            ) : (

              sessionOrders.map(
                (order) => (

                  <div
                    className="staff-open-order"
                    key={order.id}
                  >

                    <div>

                      <strong>
                        Order{" "}
                        {order.orderId ||
                          order.id}
                      </strong>

                      <span
                        className={`staff-order-status staff-status-${order.status}`}
                      >
                        {getStatusLabel(
                          order.status
                        )}
                      </span>

                    </div>

                    {order.createdAt && (
                      <p>
                        {formatDate(
                          order.createdAt
                        )}
                      </p>
                    )}

                    {Array.isArray(
                      order.items
                    ) &&
                      order.items.map(
                        (
                          item,
                          index
                        ) => {

                          const itemTotal =
                            item.total !==
                            undefined
                              ? Number(
                                  item.total
                                )
                              : Number(
                                  item.price ||
                                    item.unitPrice ||
                                    0
                                ) *
                                Number(
                                  item.quantity ||
                                    0
                                );

                          return (
                            <div
                              key={`${order.id}-${index}`}
                              className="staff-open-order"
                            >

                              <div>

                                <strong>
                                  {item.quantity ||
                                    0}{" "}
                                  ×{" "}
                                  {item.name ||
                                    "Item"}
                                </strong>

                                <span>
                                  {formatMoney(
                                    itemTotal
                                  )}
                                </span>

                              </div>

                            </div>
                          );
                        }
                      )}

                    {order.note && (
                      <div className="staff-order-note">
                        Note:{" "}
                        {order.note}
                      </div>
                    )}

                    <strong>
                      Order Total:{" "}
                      {formatMoney(
                        order.total
                      )}
                    </strong>

                  </div>

                )
              )

            )}

            <div className="staff-open-order">

              <div>

                <strong>
                  Order Total
                </strong>

                <strong>
                  {formatMoney(
                    orderTotal
                  )}
                </strong>

              </div>

            </div>

          </article>

          <article className="staff-session-card">

            <div className="staff-section-header">

              <div>

                <span className="staff-section-kicker">
                  BILL & PAYMENT
                </span>

                <h2>
                  Payment Information
                </h2>

              </div>

              <strong>
                {formatMoney(
                  sessionTotal
                )}
              </strong>

            </div>

            {sessionBills.length ===
            0 ? (

              <div className="staff-session-empty">

                No bill has been
                created for this
                session yet.

              </div>

            ) : (

              sessionBills.map(
                (bill) => (

                  <div
                    className="staff-open-order"
                    key={bill.id}
                  >

                    <div>

                      <strong>
                        Bill
                      </strong>

                      <span>
                        {getBillStatusLabel(
                          bill.status
                        )}
                      </span>

                    </div>

                    <p>
                      Bill ID:{" "}
                      {bill.id}
                    </p>

                    {bill.subtotal !==
                      undefined && (
                      <p>
                        Subtotal:{" "}
                        {formatMoney(
                          bill.subtotal
                        )}
                      </p>
                    )}

                    {bill.serviceCharge !==
                      undefined && (
                      <p>
                        Service Charge:{" "}
                        {formatMoney(
                          bill.serviceCharge
                        )}
                      </p>
                    )}

                    {bill.tax !==
                      undefined && (
                      <p>
                        Tax:{" "}
                        {formatMoney(
                          bill.tax
                        )}
                      </p>
                    )}

                    <div>

                      <strong>
                        Total
                      </strong>

                      <strong>
                        {formatMoney(
                          bill.total
                        )}
                      </strong>

                    </div>

                    <p>
                      Payment Method:{" "}
                      {getPaymentMethodLabel(
                        bill.paymentMethod
                      )}
                    </p>

                    {bill.createdAt && (
                      <p>
                        Bill Created:{" "}
                        {formatDate(
                          bill.createdAt
                        )}
                      </p>
                    )}

                    {bill.paidAt && (
                      <p>
                        Paid:{" "}
                        {formatDate(
                          bill.paidAt
                        )}
                      </p>
                    )}

                  </div>

                )
              )

            )}

          </article>

          {session.status ===
            "active" && (

            <article className="staff-session-card">

              <div>

                <span className="staff-card-label">
                  STAFF ACTION
                </span>

                <h3>
                  Force Close Session
                </h3>

                <p>
                  Use this only when a
                  session needs to be
                  closed manually for
                  an exceptional reason.
                </p>

              </div>

              <div className="staff-menu-admin-actions">

                <button
                  className="staff-danger-action"
                  disabled={
                    closingId ===
                    session.id
                  }
                  onClick={() =>
                    forceCloseSession(
                      session
                    )
                  }
                >
                  {closingId ===
                  session.id
                    ? "Closing..."
                    : "Force Close Session"}
                </button>

              </div>

            </article>

          )}

        </div>
      </section>
    );
  }

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
            <p>
              Open Air Restaurant
            </p>
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
              TABLES & REPORTS
            </span>

            <h2>
              Sessions & Reports
            </h2>

            <p>
              Manage open tables, inspect
              orders, check bills and
              review restaurant payments.
            </p>

          </div>

        </section>

        {error && (
          <div className="staff-error">

            <strong>
              Something went wrong
            </strong>

            <span>
              {error}
            </span>

            <button
              onClick={() =>
                setError("")
              }
            >
              Dismiss
            </button>

          </div>
        )}

        <div className="staff-page-tabs">

          <button
            className={
              view === "active"
                ? "staff-page-tab active"
                : "staff-page-tab"
            }
            onClick={() =>
              setView("active")
            }
          >
            Active Tables (
            {activeSessions.length})
          </button>

          <button
            className={
              view === "all"
                ? "staff-page-tab active"
                : "staff-page-tab"
            }
            onClick={() =>
              setView("all")
            }
          >
            All Sessions (
            {sessions.length})
          </button>

          <button
            className={
              view === "reports"
                ? "staff-page-tab active"
                : "staff-page-tab"
            }
            onClick={() =>
              setView("reports")
            }
          >
            Reports
          </button>

        </div>

        {/* ===================================================
            REPORTS
            =================================================== */}

        {view === "reports" ? (

          <section className="staff-report-grid">

            <div className="staff-report-card">
              <span>
                Paid Bills (All Time)
              </span>
              <strong>
                {paidBills.length}
              </strong>
            </div>

            <div className="staff-report-card">
              <span>
                Paid Revenue (All Time)
              </span>
              <strong>
                {formatMoney(
                  reportTotal
                )}
              </strong>
            </div>

            <div className="staff-report-card">
              <span>
                Paid Bills Today
              </span>
              <strong>
                {todayPaidBills.length}
              </strong>
            </div>

            <div className="staff-report-card">
              <span>
                Revenue Today
              </span>
              <strong>
                {formatMoney(
                  todayRevenue
                )}
              </strong>
            </div>

            <div className="staff-report-card">
              <span>
                Completed Orders
              </span>
              <strong>
                {reportOrders}
              </strong>
            </div>

            <div className="staff-report-card">
              <span>
                Active Tables
              </span>
              <strong>
                {activeSessions.length}
              </strong>
            </div>

            <div className="staff-report-card">
              <span>
                Open Session Value
              </span>
              <strong>
                {formatMoney(
                  openSessionValue
                )}
              </strong>
            </div>

          </section>

        ) : view === "all" ? (

          /* =================================================
             ALL SESSIONS
             ================================================= */

          <section className="staff-orders-section">

            <div className="staff-section-header">

              <div>

                <span className="staff-section-kicker">
                  SESSIONS
                </span>

                <h2>
                  All Sessions
                </h2>

                <p>
                  Every table visit currently
                  stored in the system.
                </p>

              </div>

              <span className="staff-order-count">
                {sessions.length}
              </span>

            </div>

            <div className="staff-session-list">

              {[...sessions]
                .sort(
                  (a, b) =>
                    (b.createdAt?.toMillis?.() ||
                      0) -
                    (a.createdAt?.toMillis?.() ||
                      0)
                )
                .map((session) => {

                  const sessionOrders =
                    orders.filter(
                      (order) =>
                        order.sessionId ===
                        session.id
                    );

                  const sessionBills =
                    bills.filter(
                      (bill) =>
                        bill.sessionId ===
                        session.id
                    );

                  const sessionTotal =
                    getSessionBillTotal(
                      session,
                      sessionOrders,
                      sessionBills
                    );

                  return (
                    <article
                      className="staff-session-card"
                      key={session.id}
                    >

                      <div className="staff-session-card-header">

                        <div>

                          <span className="staff-card-label">
                            {session.status ===
                            "active"
                              ? "ACTIVE"
                              : "CLOSED"}
                          </span>

                          <h3>
                            Table{" "}
                            {session.tableCode}
                          </h3>

                        </div>

                        <strong>
                          {formatMoney(
                            sessionTotal
                          )}
                        </strong>

                      </div>

                      <p>
                        Opened:{" "}
                        {formatDate(
                          session.createdAt
                        )}
                      </p>

                      <p>
                        Orders:{" "}
                        {sessionOrders.length}
                      </p>

                      {session.closedAt && (
                        <p>
                          Closed:{" "}
                          {formatDate(
                            session.closedAt
                          )}
                        </p>
                      )}

                      {session.closeReason && (
                        <p>
                          Close reason:{" "}
                          {session.closeReason}
                        </p>
                      )}

                      <div className="staff-menu-admin-actions">

                        <button
                          className="staff-secondary-action"
                          onClick={() =>
                            viewSession(
                              session.id
                            )
                          }
                        >
                          View Full Details
                        </button>

                        {session.status ===
                          "active" && (
                          <button
                            className="staff-danger-action"
                            disabled={
                              closingId ===
                              session.id
                            }
                            onClick={() =>
                              forceCloseSession(
                                session
                              )
                            }
                          >
                            {closingId ===
                            session.id
                              ? "Closing..."
                              : "Force Close"}
                          </button>
                        )}

                      </div>

                    </article>
                  );
                })}

            </div>

          </section>

        ) : (

          /* =================================================
             ACTIVE TABLES
             ================================================= */

          <section className="staff-orders-section">

            <div className="staff-section-header">

              <div>

                <span className="staff-section-kicker">
                  OPEN TABLES
                </span>

                <h2>
                  Active Tables
                </h2>

                <p>
                  Each active table and
                  the orders still open
                  on that session.
                </p>

              </div>

              <span className="staff-order-count">
                {activeSessions.length}
              </span>

            </div>

            {openTableData.length ===
            0 ? (

              <div className="staff-empty-card">

                <div className="staff-empty-icon">
                  ✓
                </div>

                <h3>
                  No active tables
                </h3>

                <p>
                  Tables will appear here
                  when customers place
                  orders.
                </p>

              </div>

            ) : (

              <div className="staff-session-list">

                {openTableData.map(
                  (session) => {

                    const allSessionOrders =
                      orders.filter(
                        (order) =>
                          order.sessionId ===
                          session.id
                      );

                    const sessionBills =
                      bills.filter(
                        (bill) =>
                          bill.sessionId ===
                          session.id
                      );

                    const sessionTotal =
                      getSessionBillTotal(
                        session,
                        allSessionOrders,
                        sessionBills
                      );

                    return (
                      <article
                        className="staff-session-card staff-open-table-card"
                        key={session.id}
                      >

                        <div className="staff-session-card-header">

                          <div>

                            <span className="staff-card-label">
                              OPEN TABLE
                            </span>

                            <h3>
                              Table{" "}
                              {session.tableCode}
                            </h3>

                          </div>

                          <strong>
                            {formatMoney(
                              sessionTotal
                            )}
                          </strong>

                        </div>

                        <p>
                          Session opened{" "}
                          {formatDate(
                            session.createdAt
                          )}
                        </p>

                        <p>
                          {
                            session.orders
                              .length
                          }{" "}
                          open order
                          {session.orders
                            .length ===
                          1
                            ? ""
                            : "s"}
                        </p>

                        {session.orders.length ===
                        0 ? (

                          <div className="staff-session-empty">
                            No open orders yet.
                          </div>

                        ) : (

                          session.orders.map(
                            (order) => (

                              <div
                                className="staff-open-order"
                                key={order.id}
                              >

                                <div>

                                  <strong>
                                    Order{" "}
                                    {order.orderId}
                                  </strong>

                                  <span
                                    className={`staff-order-status staff-status-${order.status}`}
                                  >
                                    {getStatusLabel(
                                      order.status
                                    )}
                                  </span>

                                </div>

                                <p>
                                  {order.items
                                    ?.map(
                                      (
                                        item
                                      ) =>
                                        `${
                                          item.quantity
                                        } × ${
                                          item.name
                                        }`
                                    )
                                    .join(
                                      ", "
                                    )}
                                </p>

                                {order.note && (
                                  <div className="staff-order-note">
                                    Note:{" "}
                                    {order.note}
                                  </div>
                                )}

                                <strong>
                                  {formatMoney(
                                    order.total
                                  )}
                                </strong>

                              </div>

                            )
                          )

                        )}

                        <div className="staff-menu-admin-actions">

                          <button
                            className="staff-primary-action"
                            onClick={() =>
                              viewSession(
                                session.id
                              )
                            }
                          >
                            View Full Details
                          </button>

                          <button
                            className="staff-danger-action"
                            disabled={
                              closingId ===
                              session.id
                            }
                            onClick={() =>
                              forceCloseSession(
                                session
                              )
                            }
                          >
                            {closingId ===
                            session.id
                              ? "Closing..."
                              : "Force Close"}
                          </button>

                        </div>

                      </article>
                    );
                  }
                )}

              </div>

            )}

          </section>

        )}

        {/* ===================================================
            SELECTED SESSION DETAILS
            =================================================== */}

        {selectedSession &&
          renderSessionDetails(
            selectedSession
          )}

      </main>

    </div>
  );
}