import React from "react";
import SatelliteUplinkLoader from "./SatelliteUplinkLoader.jsx";

/** Full-viewport satellite uplink loader (replaces spinning icons). */
export default function FullPageLoader() {
  return (
    <div className="min-h-screen bg-deep">
      <SatelliteUplinkLoader visible />
    </div>
  );
}
