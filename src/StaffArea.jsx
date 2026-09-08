import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./firebase";
import StaffLogin from "./StaffLogin";
import StaffDashboard from "./StaffDashboard";
import StaffSessions from "./StaffSessions";
import StaffMenuManager from "./StaffMenuManager";

import "./Staff.css";

export default function StaffArea() {
  const [staffUser, setStaffUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setStaffUser(user);
    });

    return () => unsubscribe();
  }, []);

  if (staffUser === undefined) {
    return (
      <div className="staff-loading">
        <div className="staff-loading-card">
          <div className="staff-loading-logo">S🔥</div>
          <div className="staff-spinner"></div>
          <p>Loading staff dashboard...</p>
        </div>
      </div>
    );
  }

  if (!staffUser) {
    return <StaffLogin onLogin={setStaffUser} />;
  }

  if (window.location.pathname === "/staff/sessions") {
    return <StaffSessions user={staffUser} />;
  }

  if (window.location.pathname === "/staff/menu") {
    return <StaffMenuManager user={staffUser} />;
  }

  return <StaffDashboard user={staffUser} />;
}

