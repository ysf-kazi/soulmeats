import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export default function StaffAlerts() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return (
      localStorage.getItem("soulmeatsSoundEnabled") ===
      "true"
    );
  });

  const soundEnabledRef = useRef(
    localStorage.getItem("soulmeatsSoundEnabled") ===
      "true"
  );

  const audioContextRef = useRef(null);

  const ordersInitialized = useRef(false);
  const waiterCallsInitialized = useRef(false);
  const billRequestsInitialized = useRef(false);

  /* =========================================================
     AUDIO CONTEXT
     ========================================================= */

  function getAudioContext() {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error(
          "Web Audio is not supported by this browser."
        );
        return null;
      }

      audioContextRef.current =
        new AudioContextClass();
    }

    return audioContextRef.current;
  }

  /* =========================================================
     RESTORE / ACTIVATE SOUND
     ========================================================= */

  async function restoreSound() {
    try {
      const saved =
        localStorage.getItem(
          "soulmeatsSoundEnabled"
        );

      if (saved !== "true") {
        return;
      }

      const context = getAudioContext();

      if (!context) {
        return;
      }

      if (context.state !== "running") {
        await context.resume();
      }

      if (context.state === "running") {
        soundEnabledRef.current = true;
        setSoundEnabled(true);
      }
    } catch (error) {
      console.log(
        "Browser is waiting for user interaction before allowing sound."
      );
    }
  }

  /* =========================================================
     ENABLE SOUND BUTTON
     ========================================================= */

  async function enableSound() {
    try {
      const context = getAudioContext();

      if (!context) {
        return;
      }

      await context.resume();

      if (context.state === "running") {
        soundEnabledRef.current = true;

        setSoundEnabled(true);

        localStorage.setItem(
          "soulmeatsSoundEnabled",
          "true"
        );

        await playAlert("order");
      }
    } catch (error) {
      console.error(
        "Unable to enable staff sound:",
        error
      );
    }
  }

  /* =========================================================
     PLAY ALERT
     ========================================================= */

  async function playAlert(type) {
    try {
      if (!soundEnabledRef.current) {
        return;
      }

      const context = getAudioContext();

      if (!context) {
        return;
      }

      if (context.state !== "running") {
        try {
          await context.resume();
        } catch {
          return;
        }
      }

      if (context.state !== "running") {
        return;
      }

      const now =
        context.currentTime;

      const masterGain =
        context.createGain();

      masterGain.gain.setValueAtTime(
        0.0001,
        now
      );

      masterGain.connect(
        context.destination
      );

      function playTone({
        frequency,
        frequencyEnd,
        start,
        duration,
        oscillatorType = "sine",
        volume = 0.7,
      }) {
        const oscillator =
          context.createOscillator();

        const gain =
          context.createGain();

        oscillator.type =
          oscillatorType;

        oscillator.frequency.setValueAtTime(
          frequency,
          start
        );

        if (frequencyEnd) {
          oscillator.frequency.linearRampToValueAtTime(
            frequencyEnd,
            start + duration
          );
        }

        gain.gain.setValueAtTime(
          0.0001,
          start
        );

        gain.gain.exponentialRampToValueAtTime(
          volume,
          start + 0.025
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + duration
        );

        oscillator.connect(gain);
        gain.connect(masterGain);

        oscillator.start(start);

        oscillator.stop(
          start + duration + 0.02
        );
      }

      /* =====================================================
         ORDER
         Rising arrow notification
         ===================================================== */

      if (type === "order") {
        playTone({
          frequency: 520,
          frequencyEnd: 920,
          start: now,
          duration: 0.18,
          oscillatorType: "sine",
          volume: 0.72,
        });

        playTone({
          frequency: 820,
          frequencyEnd: 1420,
          start: now + 0.09,
          duration: 0.22,
          oscillatorType: "sine",
          volume: 0.88,
        });

        playTone({
          frequency: 1050,
          frequencyEnd: 1650,
          start: now + 0.20,
          duration: 0.20,
          oscillatorType: "sine",
          volume: 0.58,
        });
      }

      /* =====================================================
         WAITER
         Buzz / vibration style
         ===================================================== */

      if (type === "waiter") {
        playTone({
          frequency: 180,
          start: now,
          duration: 0.12,
          oscillatorType: "square",
          volume: 0.65,
        });

        playTone({
          frequency: 180,
          start: now + 0.16,
          duration: 0.12,
          oscillatorType: "square",
          volume: 0.65,
        });

        playTone({
          frequency: 180,
          start: now + 0.32,
          duration: 0.12,
          oscillatorType: "square",
          volume: 0.72,
        });

        playTone({
          frequency: 145,
          start: now + 0.56,
          duration: 0.12,
          oscillatorType: "square",
          volume: 0.60,
        });

        playTone({
          frequency: 145,
          start: now + 0.72,
          duration: 0.12,
          oscillatorType: "square",
          volume: 0.68,
        });
      }

      /* =====================================================
         BILL
         ===================================================== */

      if (type === "bill") {
        playTone({
          frequency: 784,
          start: now,
          duration: 0.13,
          oscillatorType: "sine",
          volume: 0.75,
        });

        playTone({
          frequency: 988,
          start: now + 0.16,
          duration: 0.13,
          oscillatorType: "sine",
          volume: 0.82,
        });

        playTone({
          frequency: 1319,
          start: now + 0.32,
          duration: 0.24,
          oscillatorType: "sine",
          volume: 0.90,
        });
      }

      masterGain.gain.setValueAtTime(
        0.95,
        now
      );

      masterGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 1.1
      );
    } catch (error) {
      console.error(
        "Staff alert sound error:",
        error
      );
    }
  }

  /* =========================================================
     KEEP SOUND READY
     ========================================================= */

  useEffect(() => {
    restoreSound();

    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        restoreSound();
      }
    };

    const handleFocus = () => {
      restoreSound();
    };

    const handleUserInteraction = () => {
      if (
        localStorage.getItem(
          "soulmeatsSoundEnabled"
        ) === "true"
      ) {
        restoreSound();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "click",
      handleUserInteraction
    );

    document.addEventListener(
      "keydown",
      handleUserInteraction
    );

    document.addEventListener(
      "touchstart",
      handleUserInteraction
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "click",
        handleUserInteraction
      );

      document.removeEventListener(
        "keydown",
        handleUserInteraction
      );

      document.removeEventListener(
        "touchstart",
        handleUserInteraction
      );
    };
  }, []);

  /* =========================================================
     NEW ORDERS
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
        if (!ordersInitialized.current) {
          ordersInitialized.current = true;
          return;
        }

        const addedOrders =
          snapshot.docChanges().filter(
            (change) =>
              change.type === "added" &&
              change.doc.data().status ===
                "pending"
          );

        if (addedOrders.length > 0) {
          playAlert("order");
        }
      },
      (error) => {
        console.error(
          "Global order alert listener error:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     WAITER CALLS
     ========================================================= */

  useEffect(() => {
    const waiterCallsQuery =
      query(
        collection(db, "waiterCalls"),
        where(
          "status",
          "==",
          "pending"
        )
      );

    const unsubscribe = onSnapshot(
      waiterCallsQuery,
      (snapshot) => {
        if (
          !waiterCallsInitialized.current
        ) {
          waiterCallsInitialized.current =
            true;
          return;
        }

        const addedCalls =
          snapshot.docChanges().filter(
            (change) =>
              change.type === "added"
          );

        if (addedCalls.length > 0) {
          playAlert("waiter");
        }
      },
      (error) => {
        console.error(
          "Global waiter alert listener error:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     BILL REQUESTS
     ========================================================= */

  useEffect(() => {
    const billRequestsQuery =
      query(
        collection(db, "billRequests"),
        where(
          "status",
          "in",
          [
            "pending",
            "pending_verification",
          ]
        )
      );

    const unsubscribe = onSnapshot(
      billRequestsQuery,
      (snapshot) => {
        if (
          !billRequestsInitialized.current
        ) {
          billRequestsInitialized.current =
            true;
          return;
        }

        const addedBillRequests =
          snapshot.docChanges().filter(
            (change) =>
              change.type === "added"
          );

        if (
          addedBillRequests.length > 0
        ) {
          console.log(
            "NEW BILL REQUEST DETECTED",
            addedBillRequests.map(
              (change) =>
                change.doc.data()
            )
          );

          playAlert("bill");
        }
      },
      (error) => {
        console.error(
          "Global bill request alert listener error:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     GLOBAL SOUND BUTTON
     ========================================================= */

  return (
    <button
      className={
        soundEnabled
          ? "staff-sound-button enabled"
          : "staff-sound-button"
      }
      onClick={enableSound}
      title="Enable or restore restaurant alert sounds"
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: 99999,
      }}
    >
      {soundEnabled
        ? "🔊 Sound On"
        : "🔔 Enable Sound"}
    </button>
  );
}