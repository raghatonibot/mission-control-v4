import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Mobile/Tablet top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur border-b border-border">
        <div className="h-14 flex items-center gap-3 px-3 sm:px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-card/50"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-v3.svg?v=3" alt="Mission Control" className="w-6 h-6 rounded-full border border-border/50" />
            <span className="font-semibold text-foreground">Mission Control</span>
          </div>
        </div>
      </div>

      <main className={`flex-1 min-h-screen ml-0 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'} pt-14 lg:pt-0 transition-all duration-200`}>
        <div className="p-2 sm:p-3 md:p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
