import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AccountSettingsModal from '../modals/AccountSettingsModal';

const MainLayout = ({ children, pageTitle }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  return (
    <div className="app-container">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="main-content">
        <Header
          pageTitle={pageTitle}
          onAccountSettings={() => setShowAccountSettings(true)}
        />

        <main className="main-content-inner">
          {children}
        </main>
      </div>

      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
      />
    </div>
  );
};

export default MainLayout;
