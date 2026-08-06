import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('sv_live_99284jh28adsa7812ha81da');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        localStorage.removeItem('solar_token');
        navigate('/login');
      });
  }, [navigate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegen = () => {
    const randomHex = Array.from({ length: 24 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setApiKey(`sv_live_${randomHex}`);
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-primary">
          <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
          <span className="font-label-mono text-sm tracking-widest uppercase">Loading Profile...</span>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">User Profile & settings</h2>
        <p className="text-on-surface-variant text-sm mt-1">Manage your account credentials, preferences, and developer API keys.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-stack-lg">
        {/* Profile Card & Info */}
        <div className="lg:col-span-5 space-y-gutter">
          <div className="glass-card p-6 rounded-xl relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 blur-3xl rounded-full"></div>
            
            <div className="w-20 h-20 rounded-full border-2 border-primary/30 overflow-hidden mb-4">
              <img 
                className="w-full h-full object-cover" 
                alt={user?.name} 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkw9uUL-poFrg4P4rNGCBhF-8u3cjN3Js8oDItdcWVMCyx5kfh6pji_4K1xURpdcO6czLxKKLFXzGPf-1GbP--aTuGs72Jl266r-Ix-Vymo45FJ1Hbn1c4BnxsLh1dxo8wR12xELPF30sAghI-fDSKY5d4L8EGfc9Mu4p5oz4tjKQU6M9j-LjWbxV2w202NhxD5b35BwhPbMvySFlAyTZyzioiUUcaJ9kACLLxTyrR-3tYU_pquNsT"
              />
            </div>
            
            <h3 className="font-headline-md text-lg font-bold text-white mb-1">{user?.name}</h3>
            <p className="font-label-mono text-[9px] text-primary uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">Solar Director</p>
            
            <div className="w-full text-left space-y-3 mt-6 text-xs border-t border-glass-stroke pt-4">
              <div>
                <p className="text-[10px] font-label-mono text-on-surface-variant">ORGANIZATION</p>
                <p className="text-white font-semibold mt-0.5">{user?.company || 'Solar Installer Team'}</p>
              </div>
              <div>
                <p className="text-[10px] font-label-mono text-on-surface-variant">MEMBER SINCE</p>
                <p className="text-white font-semibold mt-0.5">June 2024</p>
              </div>
              <div>
                <p className="text-[10px] font-label-mono text-on-surface-variant">REGIONAL LICENSE</p>
                <p className="text-white font-semibold mt-0.5">CA-CSLB-990184</p>
              </div>
            </div>
          </div>
        </div>

        {/* Edit fields & Developer settings */}
        <div className="lg:col-span-7 space-y-gutter">
          {/* Edit Profile Fields */}
          <div className="glass-card p-6 rounded-xl space-y-4">
            <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">Account Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-on-surface-variant">Full Name</label>
                <input 
                  type="text" 
                  defaultValue={user?.name}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-white"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-on-surface-variant">Email Address</label>
                <input 
                  type="email" 
                  defaultValue={user?.email}
                  disabled
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface-variant cursor-not-allowed"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-on-surface-variant">Phone Number</label>
                <input 
                  type="text" 
                  defaultValue={user?.phone || '+1 (555) 309-8422'}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-white"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-on-surface-variant">Role Title</label>
                <input 
                  type="text" 
                  defaultValue="Solar Acquisition Lead"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-white"
                />
              </div>
            </div>
            
            <button className="bg-primary text-on-primary font-bold text-xs py-2 px-5 rounded-lg hover:brightness-110 active:scale-98 transition-all">
              Save Account Settings
            </button>
          </div>

          {/* Developer settings / API key block */}
          <div className="glass-card p-6 rounded-xl space-y-4">
            <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">Developer Settings</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Use your API keys to export leads directly into customized webhooks, CRM plugins, or internal dashboards.
            </p>

            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 flex items-center justify-between font-mono text-[11px]">
                <span>{showKey ? apiKey : '••••••••••••••••••••••••••••••••••••••••'}</span>
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="text-on-surface-variant hover:text-white p-0.5 ml-2"
                >
                  <span className="material-symbols-outlined text-sm">{showKey ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              
              <button 
                onClick={handleCopy}
                className="bg-surface-container-highest border border-glass-stroke hover:bg-surface-bright text-white py-2 px-3 rounded-lg flex items-center justify-center font-semibold gap-1 min-w-[70px] text-center"
              >
                <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              
              <button 
                onClick={handleRegen}
                className="border border-glass-stroke hover:bg-white/5 text-on-surface-variant hover:text-white py-2 px-3 rounded-lg"
                title="Regenerate API Key"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
