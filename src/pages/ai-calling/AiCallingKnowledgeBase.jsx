import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';

const API = API_BASE;

export default function AiCallingKnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [formData, setFormData] = useState({ category: 'Solar Basics', title: '', content: '', sortOrder: 0 });

  const categories = ['Solar Basics', 'Federal Tax Credit', 'Financing', 'Installation', 'Warranty', 'Panels', 'Inverters', 'Maintenance', 'Company Info', 'FAQs'];

  const loadArticles = async () => {
    const t = localStorage.getItem('solar_token');
    if (!t) return;
    try {
      const res = await fetch(`${API}/api/ai-calling/knowledge-base`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) setArticles(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArticles(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = localStorage.getItem('solar_token');
    if (!t) return;
    const url = editingArticle
      ? `${API}/api/ai-calling/knowledge-base/${editingArticle.id}`
      : `${API}/api/ai-calling/knowledge-base`;
    const method = editingArticle ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      setShowModal(false);
      setEditingArticle(null);
      setFormData({ category: 'Solar Basics', title: '', content: '', sortOrder: 0 });
      loadArticles();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this knowledge base entry?')) return;
    const t = localStorage.getItem('solar_token');
    await fetch(`${API}/api/ai-calling/knowledge-base/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` }
    });
    loadArticles();
  };

  const openEdit = (art) => {
    setEditingArticle(art);
    setFormData({ category: art.category, title: art.title, content: art.content, sortOrder: art.sort_order });
    setShowModal(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">AI Knowledge Base</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Train the AI caller on your business policies, technical FAQs, and solar facts</p>
        </div>
        <button
          onClick={() => { setEditingArticle(null); setFormData({ category: 'Solar Basics', title: '', content: '', sortOrder: 0 }); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Article
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3 block">menu_book</span>
          <h3 className="text-base font-bold text-white mb-1">Knowledge Base Empty</h3>
          <p className="text-xs text-on-surface-variant mb-4">Add articles to teach the AI how to answer objection questions during calls.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((art) => (
            <div key={art.id} className="glass-card rounded-2xl p-6 relative group">
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-primary">
                  {art.category}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(art)} className="text-slate-400 hover:text-on-surface">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button onClick={() => handleDelete(art.id)} className="text-red-400 hover:text-red-300">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-white text-sm mb-2">{art.title}</h3>
              <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">{art.content}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 font-display">
              {editingArticle ? 'Edit Knowledge Article' : 'New Knowledge Article'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. 30% Federal Investment Tax Credit (ITC)"
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Article Content (AI Information Context)</label>
                <textarea
                  required
                  rows={5}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Explain the detailed answer that the AI should convey..."
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-glass-stroke">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
