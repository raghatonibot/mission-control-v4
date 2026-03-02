import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home,
  MessageSquare,
  ClipboardList,
  History,
  Bot,
  Coins,
  Settings,
  LogOut,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Workflow,
  Bookmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

const mainNav: NavItem[] = [
  { label: 'Início', icon: Home, href: '/' },
  { label: 'Chat', icon: MessageSquare, href: '/chat' },
];

const operationsNav: NavItem[] = [
  { label: 'Operações', icon: ClipboardList, href: '/missions' },
  { label: 'Histórico', icon: History, href: '/runs-finalizadas' },
  { label: 'Agentes', icon: Bot, href: '/agents' },
  { label: 'Orquestração', icon: Workflow, href: '/orchestration' },
  { label: 'Meu Stash', icon: Bookmark, href: '/stash' },
];

const systemNav: NavItem[] = [
  { label: 'Insights', icon: Coins, href: '/tokens' },
  { label: 'Configurações', icon: Settings, href: '/settings' },
];

interface NavGroupProps {
  title: string;
  items: NavItem[];
  onNavigate?: () => void;
  collapsed?: boolean;
}

function NavGroup({ title, items, onNavigate, collapsed }: NavGroupProps) {
  const location = useLocation();

  return (
    <div className="mb-6">
      {!collapsed && (
        <h3 className="px-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) => {
          const currentPath = location.pathname;
          const isActive = currentPath === item.href || 
            (item.href !== '/' && currentPath.startsWith(item.href + '/')) ||
            (item.href !== '/' && currentPath === item.href);
          
          return (
            <a
              key={item.href}
              href={`#${item.href}`}
              onClick={() => onNavigate?.()}
              title={collapsed ? item.label : undefined}
              className={cn(
                'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative text-left',
                collapsed ? 'justify-center gap-0' : 'gap-3',
                isActive
                  ? 'bg-card text-foreground'
                  : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-500 rounded-r-full"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-emerald-500' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto bg-violet-500/20 text-violet-500 text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-label="Fechar menu"
        />
      )}

      <aside
        className={cn(
          'h-screen bg-background border-r border-border flex flex-col fixed left-0 top-0 z-50 transition-all duration-200',
          collapsed ? 'w-16 lg:w-16' : 'w-[88vw] max-w-[340px] lg:w-60',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-v3.svg?v=3"
              alt="Mission Control"
              className="w-8 h-8 rounded-full shrink-0 border border-border/50"
            />
            {!collapsed && <span className="font-semibold text-foreground truncate">Mission Control</span>}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-card/50"
              aria-label="Fechar menu"
            >
              <span className="text-base">✕</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className={cn('flex-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3 lg:p-4')}>
        <NavGroup title="Principal" items={mainNav} onNavigate={onClose} collapsed={collapsed} />
        <NavGroup title="Operações" items={operationsNav} onNavigate={onClose} collapsed={collapsed} />
        <NavGroup title="Sistema" items={systemNav} onNavigate={onClose} collapsed={collapsed} />
      </div>
      
      <div className={cn('border-t border-border space-y-2', collapsed ? 'p-2' : 'p-4')}>
        <button 
          onClick={toggleTheme}
          title={isDark ? 'Modo claro' : 'Modo escuro'}
          className={cn('rounded-lg text-sm font-medium text-muted-foreground hover:bg-card/50 hover:text-foreground transition-all w-full', collapsed ? 'flex justify-center px-0 py-2.5' : 'flex items-center gap-3 px-3 py-2.5')}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>}
        </button>
        <button title="Sair" className={cn('rounded-lg text-sm font-medium text-muted-foreground hover:bg-card/50 hover:text-foreground transition-all w-full', collapsed ? 'flex justify-center px-0 py-2.5' : 'flex items-center gap-3 px-3 py-2.5')}>
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      <button
        onClick={onToggleCollapse}
        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-card/80 shadow"
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>
    </aside>
    </>
  );
}
