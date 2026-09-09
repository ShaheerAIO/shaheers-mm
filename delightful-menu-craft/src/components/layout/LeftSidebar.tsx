import {
  LayoutGrid,
  Settings2,
  Radio,
  SlidersHorizontal,
  Layers,
  Users,
  FolderOpen,
  Archive,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMenuStore } from '@/store/menuStore';
import { useAuth } from '@/contexts/AuthContext';
import { closeWorkspace } from '@/lib/workspaceSync';
import type { TabType } from '@/types/menu';
import { cn } from '@/lib/utils';

const tabs: { id: TabType; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'menu-builder', label: 'Menu', icon: LayoutGrid },
  { id: 'modifier-library', label: 'Modifiers', icon: Settings2 },
  { id: 'stations', label: 'Stations', icon: Radio },
  { id: 'categories', label: 'Bulk', icon: Layers },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export function LeftSidebar() {
  const { activeTab, setActiveTab } = useMenuStore();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSwitchProject = () => {
    closeWorkspace();
    navigate('/workspaces');
  };

  return (
    <aside className="sidebar-rail w-[60px] h-screen bg-[hsl(var(--sidebar-bg))] flex flex-col items-center py-3">
      {/* Brand mark — "AIO" in the brand gradient, per the console wordmark */}
      <div className="mb-4 h-9 flex items-center justify-center">
        <span className="brand-aio text-[15px] tracking-tight">AIO</span>
      </div>

      <div className="pb-2 mb-2 border-b border-[var(--aio-border)]">
        <button onClick={handleSwitchProject} className="sidebar-tab" title="Projects">
          <FolderOpen className="sidebar-tab-icon" />
          <span className="sidebar-tab-label">Projects</span>
        </button>
      </div>

      <nav className="sidebar-nav flex-1" aria-label="Primary navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={cn('sidebar-tab', activeTab === tab.id && 'active')}
          >
            <tab.icon className="sidebar-tab-icon" />
            <span className="sidebar-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {isAdmin && (
        <button onClick={() => navigate('/team')} className="sidebar-tab" title="Team">
          <Users className="sidebar-tab-icon" />
          <span className="sidebar-tab-label">Team</span>
        </button>
      )}
    </aside>
  );
}
