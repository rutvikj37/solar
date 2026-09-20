import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SolarReport } from '@/components/homeowner/LeadForm/SolarReport';
import { getReportData, setReportData } from '@/lib/report-store';
import { HomeownerShell } from '@/components/homeowner/HomeownerShell';
import { API_BASE } from '@/config.js';

export default function SolarReportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetchedRef = useRef(false);

  const paramLeadCode = String(searchParams.get('leadCode') || '').trim();
  const paramExp = searchParams.get('exp');
  const paramSig = searchParams.get('sig');
  const paramAccess = useMemo(() => {
    if (!paramExp || !paramSig) return null;
    const expNum = Number(paramExp);
    if (!Number.isFinite(expNum)) return null;
    return { exp: expNum, sig: paramSig };
  }, [paramExp, paramSig]);

  const [data, setData] = useState(() => getReportData());
  const [refreshing, setRefreshing] = useState(true);
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    const snapshot = getReportData() || {};
    const leadCode = String(snapshot.leadCode || paramLeadCode || '').trim();
    const reportAccess =
      (snapshot.reportAccess?.exp && snapshot.reportAccess?.sig
        ? snapshot.reportAccess
        : null) || paramAccess;

    if (paramLeadCode && paramAccess) {
      const seeded = {
        ...snapshot,
        leadCode: paramLeadCode,
        reportAccess: paramAccess,
      };
      setReportData(seeded);
      setData(seeded);
    }

    if (!leadCode) {
      setRefreshing(false);
      navigate('/', { replace: true });
      return;
    }

    if (!reportAccess?.exp || !reportAccess?.sig) {
      setRefreshing(false);
      setAccessError(
        'This report link is missing or expired. Submit the form again or use the link from your email.',
      );
      return;
    }

    if (fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const qs = new URLSearchParams({
          exp: String(reportAccess.exp),
          sig: String(reportAccess.sig),
        });
        const res = await fetch(
          `${API_BASE}/api/marketplace/report/${encodeURIComponent(leadCode)}?${qs}`,
        );
        if (res.status === 401) {
          if (!cancelled) {
            setAccessError(
              'This report link has expired. Submit a new inquiry with the same email and address to receive a fresh link.',
            );
          }
          return;
        }
        if (!res.ok) {
          return;
        }
        const apiData = await res.json();
        const merged = {
          ...snapshot,
          ...apiData,
          leadCode,
          reportAccess: apiData.reportAccess || reportAccess,
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
          setAccessError('');
          if (paramLeadCode || paramSig) {
            navigate('/solar-report', { replace: true });
          }
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
  }, [navigate, paramLeadCode, paramAccess, paramSig]);

  if (!data && !paramLeadCode) return null;

  if (accessError && !data?.opportunityScore && !data?.solarReport && !data?.address) {
    return (
      <HomeownerShell stickyCta={false}>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <p className="text-white/80 text-sm leading-relaxed">{accessError}</p>
          <button
            type="button"
            className="mt-6 text-cyan-400 text-sm font-bold underline"
            onClick={() => navigate('/')}
          >
            Back to home
          </button>
        </div>
      </HomeownerShell>
    );
  }

  return (
    <HomeownerShell stickyCta={false}>
      {refreshing ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-white/30 py-2">
          Refreshing report data…
        </p>
      ) : null}
      {accessError ? (
        <p className="text-center text-xs text-amber-300/80 py-2 px-4">{accessError}</p>
      ) : null}
      {data ? <SolarReport data={data} /> : null}
    </HomeownerShell>
  );
}
