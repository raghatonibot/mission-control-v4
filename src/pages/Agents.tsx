import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AgentCard } from '@/components/agents/AgentCard';
import { api } from '@/lib/api';
import type { Agent } from '@/types/agent';
import { agentTemplates } from '@/data/agentTemplates';
import { motion } from 'framer-motion';
import { Play, Clock, Users } from 'lucide-react';

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.agents()
      .then((res) => setAgents(res.data || []))
      .catch(() => undefined);
  }, []);

  // MCU Agents from templates
  const mcuAgents = agentTemplates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agentes Avengers</h1>
        <p className="text-muted-foreground">Seu time de 10 agentes IA inspirados no Bhanu Teja P</p>
      </div>

      {/* MCU Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mcuAgents.map((agent, idx) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link
              to={`/agents/${agent.id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:border-purple-500/50 transition-all group"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-border overflow-hidden">
                  <img
                    src={`/agents/${agent.id}.svg?v=1`}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{agent.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{agent.mcuRole}</p>
                  
                  {/* Schedule badge */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="capitalize">{agent.schedule}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {agent.description}
              </p>

              {/* Status indicator */}
              <div className="mt-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Pronto</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-500" />
            <p className="text-sm text-muted-foreground">Total Agentes</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{mcuAgents.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Agendados</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {mcuAgents.filter(a => a.schedule !== 'on-demand').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-sm text-muted-foreground">Sob Demanda</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {mcuAgents.filter(a => a.schedule === 'on-demand').length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-4 h-4 text-blue-500">⚡</span>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{agents.length || 0}</p>
        </div>
      </div>

      {/* Live Agents from API */}
      {agents.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Agentes Ativos</h2>
            <span className="text-xs text-muted-foreground">(via API)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
