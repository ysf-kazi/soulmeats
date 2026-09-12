import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./firebase";
import StaffLogin from "./StaffLogin";
import StaffDashboard from "./StaffDashboard";
import StaffSessions from "./StaffSessions";
import StaffMenuManager from "./StaffMenuManager";
import StaffAlerts from "./StaffAlerts";

import "./Staff.css";

export default function StaffArea() {
  const [staffUser, setStaffUser] = useState(undefined);
  const [currentPath, setCurrentPath] =
    useState(window.location.pathname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setStaffUser(user);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(
        window.location.pathname
      );
    };

    window.addEventListener(
      "popstate",
      handlePopState
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState
      );
    };
  }, []);

  function navigateTo(path) {
    window.history.pushState(
      {},
      "",
      path
    );

    setCurrentPath(path);
  }

  if (staffUser === undefined) {
    return (
      <div className="staff-loading">
        <div className="staff-loading-card">
          <div className="staff-loading-logo">
            S🔥
          </div>

          <div className="staff-spinner"></div>

          <p>
            Loading staff dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!staffUser) {
    return (
      <StaffLogin
        onLogin={setStaffUser}
      />
    );
  }

  const base =
    import.meta.env.BASE_URL.replace(
      /\/$/,
      ""
    );

  let path =
    currentPath.replace(base, "") || "/";

  /*
   * Global staff alerts stay mounted while
   * moving between staff sections.
   */

  let staffPage;

  if (path === "/staff/sessions") {
    staffPage = (
      <StaffSessions
        user={staffUser}
      />
    );
  } else if (path === "/staff/menu") {
    staffPage = (
      <StaffMenuManager
        user={staffUser}
      />
    );
  } else {
    staffPage = (
      <StaffDashboard
        user={staffUser}
      />
    );
  }

  return (
    <>
      <StaffAlerts />

      {staffPage}
    </>
  );
}