import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { agents } from '@/data/agents';
import { cn } from '@/lib/utils';

interface AgentInOffice {
  id: string;
  x: number;
  y: number;
  message?: string;
  messageTime?: number;
}

// Workstation positions for the larger startup office
const workstations = [
  { x: 28, y: 35, name: 'Mesa 1' },   // Left cluster
  { x: 38, y: 28, name: 'Mesa 2' },   // Top-left
  { x: 48, y: 35, name: 'Mesa 3' },   // Center-left
  { x: 58, y: 28, name: 'Mesa 4' },   // Top-center
  { x: 68, y: 35, name: 'Mesa 5' },   // Center-right
  { x: 78, y: 28, name: 'Mesa 6' },   // Top-right
  { x: 35, y: 55, name: 'Mesa 7' },   // Bottom-left
  { x: 55, y: 50, name: 'Mesa 8' },   // Bottom-center
];

// Messages that agents can show
const agentMessages = [
  'Já estou nisso...',
  'Analisando dados...',
  'Quase pronto!',
  'Processando...',
  'Boa ideia!',
  'Em andamento!',
  'Pesquisando...',
  'Codando...',
];

export function VirtualOffice({ height = 520 }: { height?: number }) {
  const [officeAgents, setOfficeAgents] = useState<AgentInOffice[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  // Get only active agents (memoized to avoid render loops)
  const activeAgents = useMemo(() => agents.filter(a => a.status === 'active'), []);

  // Initialize agents at workstations
  useEffect(() => {
    const initialAgents = activeAgents.slice(0, workstations.length).map((agent, idx) => ({
      id: agent.id,
      x: workstations[idx].x,
      y: workstations[idx].y,
    }));
    setOfficeAgents(initialAgents);
  }, [activeAgents]);

  // Random messages
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        setOfficeAgents(prev => 
          prev.map(agent => {
            if (Math.random() < 0.2 && !agent.message) {
              return {
                ...agent,
                message: agentMessages[Math.floor(Math.random() * agentMessages.length)],
                messageTime: Date.now(),
              };
            }
            return agent;
          })
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Clear old messages
  useEffect(() => {
    const interval = setInterval(() => {
      setOfficeAgents(prev =>
        prev.map(agent => {
          if (agent.messageTime && Date.now() - agent.messageTime > 4000) {
            return { ...agent, message: undefined, messageTime: undefined };
          }
          return agent;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const activeCount = activeAgents.length;
  const idleCount = agents.filter((a) => a.status === 'idle').length;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Escritório Virtual</h3>
          <p className="text-sm text-muted-foreground">Visão do escritório virtual</p>
        </div>
        <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Ao vivo</span>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: `${height}px` }}>
        {/* Background Office Image */}
        <img 
          src="/virtual-office-bg.png" 
          alt="Escritório Virtual"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Agents Overlay */}
        <div className="absolute inset-0">
          {officeAgents.map((officeAgent) => {
            const agent = activeAgents.find(a => a.id === officeAgent.id);
            if (!agent) return null;

            return (
              <motion.div
                key={agent.id}
                className="absolute"
                style={{
                  left: `${officeAgent.x}%`,
                  top: `${officeAgent.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
              >
                {/* Speech Bubble */}
                <AnimatePresence>
                  {officeAgent.message && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.8 }}
                      className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap z-20"
                    >
                      <div className="bg-white text-gray-900 text-xs px-3 py-1.5 rounded-lg shadow-lg border border-gray-200">
                        {officeAgent.message}
                        {/* Triangle */}
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Agent Avatar */}
                <motion.div
                  className={cn(
                    "relative w-14 h-14 rounded-full flex items-center justify-center text-2xl cursor-pointer transition-all",
                    "border-3 shadow-lg",
                    agent.status === 'active' 
                      ? 'bg-emerald-500 border-emerald-400 shadow-emerald-500/30' 
                      : 'bg-amber-500 border-amber-400 shadow-amber-500/30',
                    hoveredAgent === agent.id && 'scale-110'
                  )}
                  whileHover={{ scale: 1.1 }}
                  animate={{
                    y: [0, -4, 0],
                  }}
                  transition={{
                    y: {
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  }}
                >
                  {agent.emoji}
                  
                  {/* Status Dot */}
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white",
                    agent.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                  )} />
                </motion.div>

                {/* Agent Name Label */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="bg-black/80 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                    {agent.name}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Ativos: {activeCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">Ociosos: {idleCount}</span>
        </div>
      </div>
    </div>
  );
}
