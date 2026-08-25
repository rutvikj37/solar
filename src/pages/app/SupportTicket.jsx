import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';

export default function SupportTicket() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('solar_token')}`,
    'Content-Type': 'application/json'
  });

  const load = async () => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/tickets/${id}`, { headers: headers() });
      if (!res.ok) throw new Error('Ticket not found');
      setData(await res.json());
    } catch (err) {
      alert(err.message);
      navigate('/support');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, navigate]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    const res = await fetch(`${API_BASE}/api/tickets/${id}/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ body: reply })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to send');
      return;
    }
    setReply('');
    load();
  };

  if (loading || !data) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">sync</span>
      </div>
    );
  }

  const { ticket, messages } = data;

  return (
    <>
      <div className="mb-4">
        <Link to="/support" className="text-xs text-primary font-semibold hover:underline">
          ← Back to Support
        </Link>
        <h2 className="font-headline-lg text-2xl font-bold text-white mt-2">{ticket.subject}</h2>
        <p className="text-on-surface-variant text-xs mt-1">
          #{ticket.id} · {ticket.category} · <span className="text-primary">{ticket.status}</span>
        </p>
      </div>

      <div className="glass-card rounded-xl p-4 mb-4 space-y-3 max-h-[55vh] overflow-y-auto text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-lg ${m.sender_role === 'admin' ? 'bg-primary/10 border border-primary/20' : 'bg-white/5'}`}
          >
            <p className="text-[10px] text-on-surface-variant mb-1">
              {m.sender_name || m.sender_role} · {new Date(m.created_at).toLocaleString()}
            </p>
            <p className="text-white whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>

      {!['closed', 'resolved'].includes(ticket.status) ? (
        <form onSubmit={send} className="flex gap-2 text-xs">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg px-3 py-2.5 text-white"
          />
          <button type="submit" className="bg-primary text-on-primary font-bold px-4 py-2 rounded-lg">
            Send
          </button>
        </form>
      ) : (
        <p className="text-xs text-on-surface-variant">This ticket is {ticket.status}.</p>
      )}
    </>
  );
}
