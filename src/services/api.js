import { API_BASE } from '../config.js';

const getAuthHeaders = () => {
  const token = localStorage.getItem('solar_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, config);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// API Service Methods
export const apiService = {
  // Auth
  getMe: () => apiRequest('/api/auth/me'),

  // Leads
  getLeads: () => apiRequest('/api/leads'),
  getLead: (id) => apiRequest(`/api/leads/${id}`),
  updateLeadStatus: (id, status) => apiRequest(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  bulkDeleteLeads: (leadIds) => apiRequest('/api/leads/bulk-delete', { method: 'POST', body: JSON.stringify({ leadIds }) }),
  pushWebhook: (leadId, webhookUrl) => apiRequest(`/api/leads/${leadId}/webhook`, { method: 'POST', body: JSON.stringify({ webhookUrl }) }),

  // Properties & Map
  searchProperties: (query, polygon) => apiRequest(`/api/properties/search?q=${encodeURIComponent(query)}${polygon ? `&polygon=${encodeURIComponent(JSON.stringify(polygon))}` : ''}`),
  getPresets: () => apiRequest('/api/presets'),
  savePreset: (name, filtersJson) => apiRequest('/api/presets', { method: 'POST', body: JSON.stringify({ name, filtersJson }) }),

  // Drip Campaigns
  getDripCampaigns: () => apiRequest('/api/drip/campaigns'),
  getDripCampaign: (id) => apiRequest(`/api/drip/campaigns/${id}`),
  createDripCampaign: (payload) => apiRequest('/api/drip/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  updateDripCampaign: (id, payload) => apiRequest(`/api/drip/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateDripSteps: (id, steps) => apiRequest(`/api/drip/campaigns/${id}/steps`, { method: 'PUT', body: JSON.stringify({ steps }) }),
  updateDripTriggers: (id, triggers) => apiRequest(`/api/drip/campaigns/${id}/triggers`, { method: 'PUT', body: JSON.stringify({ triggers }) }),
  toggleDripStatus: (id, status) => apiRequest(`/api/drip/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteDripCampaign: (id) => apiRequest(`/api/drip/campaigns/${id}`, { method: 'DELETE' }),
  getDripEnrollments: (id, page = 1) => apiRequest(`/api/drip/campaigns/${id}/enrollments?page=${page}`),
  getDripStats: (id) => apiRequest(`/api/drip/campaigns/${id}/stats`),
  getDripFunnel: (id) => apiRequest(`/api/drip/campaigns/${id}/funnel`),
  enrollLeadsInCampaign: (id, payload = {}) => apiRequest(`/api/drip/campaigns/${id}/enroll`, { method: 'POST', body: JSON.stringify(payload) }),
  cancelDripEnrollment: (enrollmentId) => apiRequest(`/api/drip/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),
  getLeadDripEnrollments: (leadId) => apiRequest(`/api/drip/leads/${leadId}/enrollments`),
  runPendingDrip: () => apiRequest('/api/drip/run-pending', { method: 'POST' }),

  // Team & Analytics
  getTeamMembers: () => apiRequest('/api/team/members'),
  inviteTeamMember: (memberEmail, role) => apiRequest('/api/team/invite', { method: 'POST', body: JSON.stringify({ memberEmail, role }) }),
  revokeTeamMember: (id) => apiRequest(`/api/team/members/${id}`, { method: 'DELETE' }),
  getTerritoryAnalytics: () => apiRequest('/api/team/territory-analytics')
};

export default apiService;
