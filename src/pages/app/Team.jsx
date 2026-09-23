import React from 'react';
import TeamWorkspacePanel from '../../components/TeamWorkspacePanel';

export default function Team() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Account</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">Team</h1>
        <p className="text-sm text-on-surface-variant max-w-2xl">
          Invite teammates, assign roles, and share your lead pipeline and credit pool.
        </p>
      </header>
      <TeamWorkspacePanel />
    </div>
  );
}
