import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/useTheme';
import { Bell, Shield, Key, User, Sun, Moon, Globe } from 'lucide-react';

export function Settings() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    agentActivity: true,
    missionUpdates: true,
    systemAlerts: true,
  });
  
  const [preferences, setPreferences] = useState({
    autoRefresh: true,
    compactView: false,
  });
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e configurações</p>
      </div>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-2">
          <TabsTrigger value="general" className="gap-2">
            <User className="w-4 h-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Globe className="w-4 h-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              {isDark ? <Moon className="w-5 h-5 text-emerald-500" /> : <Sun className="w-5 h-5 text-emerald-500" />}
              <h3 className="font-semibold text-foreground">Aparência</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">Use tema escuro em todo o app</p>
                </div>
                <Switch
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <Separator className="bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Atualização Automática</Label>
                  <p className="text-sm text-muted-foreground">Atualiza dados automaticamente a cada 30 segundos</p>
                </div>
                <Switch
                  checked={preferences.autoRefresh}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, autoRefresh: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <Separator className="bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Visão Compacta</Label>
                  <p className="text-sm text-muted-foreground">Mostre mais conteúdo com menos espaçamento</p>
                </div>
                <Switch
                  checked={preferences.compactView}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, compactView: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Perfil</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Nome de Exibição</Label>
                <Input
                  defaultValue="Administrador"
                  className="mt-2 bg-background"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <Input
                  defaultValue="admin@carvalhoai.com"
                  type="email"
                  className="mt-2 bg-background"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Preferências de Notificação</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">Receba atualizações por email</p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <Separator className="bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Notificações Push</Label>
                  <p className="text-sm text-muted-foreground">Receba notificações no navegador</p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <Separator className="bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Atividade de Agentes</Label>
                  <p className="text-sm text-muted-foreground">Seja notificado quando agentes completarem tarefas</p>
                </div>
                <Switch
                  checked={notifications.agentActivity}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, agentActivity: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <Separator className="bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Atualizações de Missões</Label>
                  <p className="text-sm text-muted-foreground">Seja notificado sobre mudanças de status de missões</p>
                </div>
                <Switch
                  checked={notifications.missionUpdates}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, missionUpdates: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
              
              <Separator className="bg-border" />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Alertas do Sistema</Label>
                  <p className="text-sm text-muted-foreground">Seja notificado sobre eventos e erros do sistema</p>
                </div>
                <Switch
                  checked={notifications.systemAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, systemAlerts: checked })
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="integrations" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Integrações</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Conecte serviços externos e APIs para estender as capacidades do Centro de Comando.
            </p>
            <Button className="mt-4 bg-emerald-500 hover:bg-emerald-600">
              Explorar Integrações
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="security" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Chaves de API</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">URL do Gateway OpenClaw</Label>
                <Input
                  defaultValue="http://127.0.0.1:18789"
                  className="mt-2 bg-background"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Token do Gateway</Label>
                <Input
                  type="password"
                  defaultValue="seu-token-aqui"
                  className="mt-2 bg-background"
                />
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <Button variant="outline">Testar Conexão</Button>
              <Button className="bg-emerald-500 hover:bg-emerald-600">Salvar Alterações</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
