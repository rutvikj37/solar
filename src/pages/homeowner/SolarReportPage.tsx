import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SolarReport } from '@/components/homeowner/LeadForm/SolarReport';
import { getReportData, setReportData } from '@/lib/report-store';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';
import { API_BASE } from '@/config.js';

export default function SolarReportPage() {
  const localData = getReportData();
  const navigate = useNavigate();
  const [data, setData] = useState(localData);
  const [refreshing, setRefreshing] = useState(Boolean(localData?.leadCode));
  const fetchedRef = useRef(false);

  useEffect(() => {
    const snapshot = getReportData();
    if (!snapshot) {
      navigate('/', { replace: true });
      return;
    }

    const leadCode = String(snapshot.leadCode || '').trim();
    if (!leadCode) {
      setRefreshing(false);
      return;
    }

    if (fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/marketplace/report/${encodeURIComponent(leadCode)}`,
        );
        if (!res.ok) {
          return;
        }
        const apiData = await res.json();
        const merged = {
          ...snapshot,
          ...apiData,
          firstName: snapshot.firstName ?? apiData.firstName,
          lastName: snapshot.lastName ?? apiData.lastName,
          email: snapshot.email ?? apiData.email,
          phone: snapshot.phone ?? apiData.phone,
          monthlyBill: snapshot.monthlyBill ?? apiData.monthlyBill,
          roofType: snapshot.roofType ?? apiData.roofType,
          timeline: snapshot.timeline ?? apiData.timeline,
          ownership: snapshot.ownership,
          propertyType: snapshot.propertyType ?? apiData.propertyType,
          solarReport: apiData.solarReport ?? snapshot.solarReport ?? null,
          satelliteImageUrl: apiData.satelliteImageUrl ?? snapshot.satelliteImageUrl ?? null,
          enrichmentSource: apiData.enrichmentSource ?? snapshot.enrichmentSource ?? 'estimated',
          dataSources: apiData.dataSources ?? snapshot.dataSources ?? null,
          googleSolarHit:
            apiData.enrichmentSource === 'google_solar' ||
            snapshot.googleSolarHit ||
            Boolean(apiData.solarReport?.systemKw),
        };
        if (!cancelled) {
          setData(merged);
          setReportData(merged);
        }
      } catch (err) {
        console.error('[SolarReportPage] Failed to refresh report from API:', err);
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!localData) return null;

  return (
    <HomeownerShell stickyCta={false}>
      {refreshing ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/30 py-2">
          Refreshing report data…
        </p>
      ) : null}
      <SolarReport data={data || localData} />
    </HomeownerShell>
  );
}
