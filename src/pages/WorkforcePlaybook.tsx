import { Bot, Target, ShieldCheck, Zap } from 'lucide-react';

const useCases = [
  {
    title: 'Captação de oportunidades (IronMan + BlackWidow)',
    input: 'Mapear oportunidades de IA para imobiliária e negócios locais',
    output: 'Lista priorizada com potencial de receita, risco e próximo passo',
    kpi: 'Oportunidades qualificadas por semana',
  },
  {
    title: 'Priorização executiva (Fury)',
    input: 'Backlog bruto com dezenas de ideias',
    output: 'Top 5 da semana com racional de impacto x esforço',
    kpi: 'Taxa de conclusão do plano semanal',
  },
  {
    title: 'Entrega técnica (Shuri + Thor + Hulk)',
    input: 'Task aprovada no board',
    output: 'Implementação + QA + evidência de funcionamento',
    kpi: 'Lead time e retrabalho',
  },
  {
    title: 'Documentação operacional (Pepper)',
    input: 'Feature ou fluxo concluído',
    output: 'SOP enxuto: objetivo, passos, riscos, rollback',
    kpi: 'Tempo de onboarding e incidentes por operação',
  },
];

const quickCommands = [
  "@Ragha status geral e gargalos de hoje",
  "@Fury priorizar backlog com foco em receita",
  "@IronMan pesquisar 10 ferramentas para captação",
  "@Thor executar task_123 com plano em 5 passos",
  "@Hulk validar task_123 e abrir bugs críticos",
  "@Pepper documentar SOP da task_123",
];

export function WorkforcePlaybook() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-500" /> Funcionários IA
        </h1>
        <p className="text-muted-foreground mt-2">
          Guia prático para transformar agentes em equipe operacional previsível.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold">Regra de uso</h3>
          </div>
          <p className="text-sm text-muted-foreground">Sempre iniciar por objetivo, prazo e critério de pronto.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold">Governança</h3>
          </div>
          <p className="text-sm text-muted-foreground">Aprovação humana obrigatória em ações críticas e decisões sensíveis.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold">Cadência</h3>
          </div>
          <p className="text-sm text-muted-foreground">Check-in 15min, standup diário e revisão semanal de KPIs.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3">Casos de uso reais</h2>
        <div className="space-y-3">
          {useCases.map((c) => (
            <div key={c.title} className="border border-border rounded-lg p-3">
              <h3 className="font-medium text-foreground">{c.title}</h3>
              <p className="text-sm text-muted-foreground mt-1"><b>Input:</b> {c.input}</p>
              <p className="text-sm text-muted-foreground"><b>Saída:</b> {c.output}</p>
              <p className="text-sm text-muted-foreground"><b>KPI:</b> {c.kpi}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3">Comandos prontos</h2>
        <div className="space-y-2">
          {quickCommands.map((cmd) => (
            <pre key={cmd} className="text-xs bg-background border border-border rounded px-3 py-2 overflow-auto">{cmd}</pre>
          ))}
        </div>
      </div>
    </div>
  );
}

