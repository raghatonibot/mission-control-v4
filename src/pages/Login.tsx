import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth disabled upstream (Cloudflare Access) — keep page but make it a no-op.
  if (import.meta.env.VITE_AUTH_DISABLED === '1') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-6 space-y-4 text-center">
          <h1 className="text-2xl font-bold text-foreground">Mission Control</h1>
          <p className="text-muted-foreground">Login desativado.</p>
          <p className="text-xs text-muted-foreground">Se você está vendo isso, abra a raiz do app.</p>
        </Card>
      </div>
    );
  }
  const handleSetup = async () => {
    setError(null);
    const res = await api.authSetup();
    setQr(res.qr);
  };

  const handleLogin = async () => {
    try {
      setError(null);
      await login(email, code);
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha no login';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mission Control</h1>
          <p className="text-muted-foreground">Login com TOTP (Google Auth)</p>
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
        <div className="space-y-2">
          <Label>Código TOTP</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSetup}>Gerar QR</Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleLogin}>Entrar</Button>
        </div>

        {qr && (
          <div className="pt-4">
            <p className="text-sm text-muted-foreground mb-2">Escaneie no Google Authenticator:</p>
            <img src={qr} alt="QR TOTP" className="w-48 h-48" />
          </div>
        )}
      </Card>
    </div>
  );
}
