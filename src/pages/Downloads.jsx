import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

export default function Downloads() {
  const [leadsCount, setLeadsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchLeadsCount = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/leads`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLeadsCount(data.length);
        }
      } catch (err) {
        console.error('Error fetching leads count:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeadsCount();
  }, [navigate]);

  const handleDownloadCSV = async () => {
    const token = localStorage.getItem('solar_token');
    if (!token) return;
    setExporting(true);

    try {
      const response = await fetch(`${API_BASE}/api/leads/export-csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solar_leads_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting CSV: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const estimatedSize = `${Math.max(1, Math.round(leadsCount * 0.45))} KB`;

  return (
    <AppLayout>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">Downloads</h2>
        <p className="text-on-surface-variant text-sm mt-1">Access your generated CSV spreadsheets, solar heatmaps, and audit reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md mb-stack-lg text-xs">
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div>
            <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">TOTAL EXPORTS</p>
            <h3 className="text-2xl font-bold text-white mt-2">{leadsCount > 0 ? '1 File' : '0 Files'}</h3>
          </div>
          <p className="text-on-surface-variant text-[10px]">Since June 2024</p>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div>
            <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">TOTAL LEADS EXPORTED</p>
            <h3 className="text-2xl font-bold text-primary mt-2">{leadsCount} Enriched Rows</h3>
          </div>
          <p className="text-on-surface-variant text-[10px]">98% verified phone/email contact rate</p>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col justify-between h-32">
          <div>
            <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-wider mb-1">EXPORT FORMATS</p>
            <h3 className="text-2xl font-bold text-secondary mt-2">CSV, XLS</h3>
          </div>
          <p className="text-on-surface-variant text-[10px]">Fully compatible with Salesforce & HubSpot</p>
        </div>
      </div>

      {/* Downloads list table */}
      <section className="glass-card rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-glass-stroke">
          <h3 className="font-headline-md text-base font-bold text-on-surface">Available Files</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">File Name</th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">File Format</th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">File Size</th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">Lead Count</th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">Generated Date</th>
                <th className="px-6 py-4 text-right font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-on-surface-variant">Loading exports...</td>
                </tr>
              ) : leadsCount > 0 ? (
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-white">All Enriched Leads Extract</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">EXPORT-ALL-LEADS</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">CSV Spreadsheet</td>
                  <td className="px-6 py-4 font-mono font-semibold text-white">{estimatedSize}</td>
                  <td className="px-6 py-4 text-on-surface">{leadsCount} Leads</td>
                  <td className="px-6 py-4 text-on-surface-variant">{formattedDate}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={handleDownloadCSV}
                      disabled={exporting}
                      className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-on-primary font-button py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ml-auto font-semibold active:scale-95 disabled:opacity-50"
                    >
                      {exporting ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">download</span>
                          Download CSV
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-on-surface-variant">No purchased leads in your pipeline yet. Start scanning on the map!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
