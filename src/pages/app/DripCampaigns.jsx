import React, { useState, useEffect, useCallback } from 'react';
import DripCampaignList from '../../components/drip/DripCampaignList';
import DripCampaignEditor from '../../components/drip/DripCampaignEditor';
import DripStepBuilder from '../../components/drip/DripStepBuilder';
import DripEnrollmentTable from '../../components/drip/DripEnrollmentTable';
import DripStatsBar from '../../components/drip/DripStatsBar';
import DripFunnelChart from '../../components/drip/DripFunnelChart';
import { apiService } from '../../services/api.js';
import ApiErrorBanner from '../../components/layout/ApiErrorBanner.jsx';

const DEFAULT_FORM = {
  name: '',
  description: '',
  triggerMinScore: 70,
  enrollmentMode: 'score_gated',
  timezone: 'America/New_York',
  quietHoursStart: '09:00:00',
  quietHoursEnd: '20:00:00',
  stopOnReply: true,
};

const DEFAULT_STEPS = [
  {
    order: 1,
    delayDays: 0,
    delayHours: 0,
    actionType: 'email',
    subject: 'Solar opportunity at {address}',
    templateContent:
      'Hi {owner_name},\n\nYour property at {address} has strong solar potential (~{estimated_savings} in 25-yr savings).\n\nWould you like a free site assessment?\n\n— {company_name}',
  },
  {
    order: 2,
    delayDays: 2,
    delayHours: 0,
    actionType: 'email',
    subject: 'Solar Savings Assessment for {address}',
    templateContent:
      'Hi {owner_name},\n\nWe analyzed {address} and estimated {estimated_savings} in 25-year bill savings.\n\nWould you like to book a 10-minute site audit?\n\n— {company_name}',
  },
];

export default function DripCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoadError('');
      const data = await apiService.getDripCampaigns();
      setCampaigns(data);
    } catch (err) {
      setLoadError(err.message || 'Failed to load drip campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); return; }
    try {
      const data = await apiService.getDripCampaign(id);
      setDetail(data);
      setForm({
        name: data.name,
        description: data.description,
        triggerMinScore: data.triggerMinScore,
        enrollmentMode: data.enrollmentMode,
        timezone: data.timezone,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        stopOnReply: data.stopOnReply,
      });
      setSteps(data.steps || DEFAULT_STEPS);
    } catch (err) {
      console.error('Fetch campaign detail error:', err);
    }
  }, []);

  const fetchEnrollments = useCallback(async (id) => {
    if (!id) { setEnrollments([]); return; }
    setEnrollmentsLoading(true);
    try {
      const data = await apiService.getDripEnrollments(id);
      setEnrollments(data.enrollments || []);
    } catch (err) {
      console.error('Fetch enrollments error:', err);
    } finally {
      setEnrollmentsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      fetchEnrollments(selectedId);
    }
  }, [selectedId, fetchDetail, fetchEnrollments]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setEditMode(false);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const next = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await apiService.toggleDripStatus(id, next);
      fetchCampaigns();
      if (selectedId === id) fetchDetail(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this drip campaign and all enrollments?')) return;
    try {
      await apiService.deleteDripCampaign(id);
      if (selectedId === id) setSelectedId(null);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const result = await apiService.createDripCampaign({ ...form, steps });
      setShowCreate(false);
      setForm(DEFAULT_FORM);
      setSteps(DEFAULT_STEPS);
      setMessage('Campaign created — SpaceToRoof.com server delivers steps automatically.');
      await fetchCampaigns();
      setSelectedId(result.id);
    } catch (err) {
      setMessage(err.message || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiService.updateDripCampaign(selectedId, form);
      await apiService.updateDripSteps(selectedId, steps);
      setEditMode(false);
      setMessage('Campaign saved.');
      fetchCampaigns();
      fetchDetail(selectedId);
    } catch (err) {
      setMessage(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEnrollment = async (enrollmentId) => {
    try {
      await apiService.cancelDripEnrollment(enrollmentId);
      fetchEnrollments(selectedId);
      fetchDetail(selectedId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkEnroll = async () => {
    if (!selectedId) return;
    try {
      const result = await apiService.enrollLeadsInCampaign(selectedId);
      setMessage(`Enrolled ${result.enrolled} leads (${result.skipped} skipped).`);
      fetchEnrollments(selectedId);
      fetchDetail(selectedId);
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-primary">
          <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
          <span className="font-label-mono text-sm tracking-widest uppercase">Loading Drip Campaigns...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <ApiErrorBanner error={loadError} onRetry={fetchCampaigns} />
      <div className="space-y-6 text-xs max-w-7xl mx-auto pb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-glass-stroke pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-headline-lg text-2xl font-bold text-primary">Automated Drip Workflows</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                Runs on SpaceToRoof.com server
              </span>
            </div>
            <p className="text-on-surface-variant text-xs">
              Email nurture sequences with score-gated enrollment, business hours, and stop-on-reply. Delivery runs on the API process, not this browser.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); setSteps(DEFAULT_STEPS); }}
              className="bg-primary text-on-primary font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg hover:brightness-110"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Campaign
            </button>
          </div>
        </div>

        {message && (
          <div className="p-3 rounded-xl bg-primary/15 border border-primary/30 text-primary font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <DripCampaignList
              campaigns={campaigns}
              selectedId={selectedId}
              onSelect={handleSelect}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          </div>

          <div className="lg:col-span-3 space-y-5">
            {!selectedId && !showCreate && (
              <div className="glass-card rounded-2xl p-8 text-center text-slate-400 border border-glass-stroke">
                Select a campaign or create a new one
              </div>
            )}

            {(showCreate || (selectedId && editMode)) && (
              <div className="glass-card rounded-2xl p-6 border border-glass-stroke space-y-5">
                <h3 className="font-bold text-on-surface">{showCreate ? 'Create Campaign' : 'Edit Campaign'}</h3>
                <DripCampaignEditor form={form} onChange={setForm} />
                <div>
                  <h4 className="text-xs font-bold text-on-surface mb-3 uppercase tracking-wider">Workflow Steps</h4>
                  <DripStepBuilder steps={steps} onChange={setSteps} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setEditMode(false); }}
                    className="px-4 py-2 rounded-xl bg-white/5 text-on-surface font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={showCreate ? handleCreate : handleSaveEdits}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:brightness-110 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : showCreate ? 'Create Campaign' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {selectedId && detail && !editMode && !showCreate && (
              <>
                <div className="glass-card rounded-2xl p-6 border border-glass-stroke space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-on-surface text-lg">{detail.name}</h3>
                      {detail.description && <p className="text-slate-400 text-xs mt-1">{detail.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMode(true)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-on-surface text-xs font-bold hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkEnroll}
                        className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold border border-primary/30"
                      >
                        Bulk Enroll
                      </button>
                    </div>
                  </div>
                  <DripStatsBar stats={detail.stats} />
                  <DripFunnelChart funnel={detail.funnel} />
                </div>

                <div className="glass-card rounded-2xl p-6 border border-glass-stroke space-y-4">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Workflow Steps</h4>
                  <DripStepBuilder steps={detail.steps || []} onChange={() => {}} readOnly />
                </div>

                <div className="glass-card rounded-2xl p-6 border border-glass-stroke space-y-4">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Enrollments</h4>
                  <DripEnrollmentTable
                    enrollments={enrollments}
                    onCancel={handleCancelEnrollment}
                    loading={enrollmentsLoading}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
