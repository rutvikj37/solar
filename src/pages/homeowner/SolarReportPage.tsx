import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SolarReport } from '@/components/solar/LeadForm/SolarReport';
import { getReportData, setReportData } from '@/lib/report-store';
import { HomeownerShell } from '@/homeowner/HomeownerShell';
import { API_BASE } from '@/config.js';

export default function SolarReportPage() {
  const localData = getReportData();
  const navigate = useNavigate();
  const [data, setData] = useState(localData);
  const [refreshing, setRefreshing] = useState(Boolean(localData?.leadCode));

  useEffect(() => {
    if (!localData) {
      navigate('/', { replace: true });
      return;
    }

    const leadCode = String(localData.leadCode || '').trim();
    if (!leadCode) {
      setRefreshing(false);
      return;
    }

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
          ...localData,
          ...apiData,
          firstName: localData.firstName ?? apiData.firstName,
          lastName: localData.lastName ?? apiData.lastName,
          email: localData.email ?? apiData.email,
          phone: localData.phone ?? apiData.phone,
          monthlyBill: localData.monthlyBill ?? apiData.monthlyBill,
          roofType: localData.roofType ?? apiData.roofType,
          timeline: localData.timeline ?? apiData.timeline,
          ownership: localData.ownership,
          propertyType: localData.propertyType ?? apiData.propertyType,
          solarReport: apiData.solarReport ?? localData.solarReport ?? null,
          satelliteImageUrl: apiData.satelliteImageUrl ?? localData.satelliteImageUrl ?? null,
          enrichmentSource: apiData.enrichmentSource ?? localData.enrichmentSource ?? 'estimated',
          dataSources: apiData.dataSources ?? localData.dataSources ?? null,
          googleSolarHit:
            apiData.enrichmentSource === 'google_solar' ||
            localData.googleSolarHit ||
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
  }, [localData, navigate]);

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
