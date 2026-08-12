import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import SatelliteUplinkLoader from "./SatelliteUplinkLoader.jsx";

const TRANSITION_MS = 1000;

/**
 * Shows the satellite uplink overlay for 2s on every route change
 * so page transitions feel consistent across the app.
 */
export default function PageTransitionLoader() {
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return <SatelliteUplinkLoader visible={visible} />;
}
