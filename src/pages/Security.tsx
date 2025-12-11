import { useState } from "react";
import { Shield, Lock, Key, AlertTriangle, CheckCircle, Users, Eye, EyeOff } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { GeoBlockSettings } from "@/components/GeoBlockSettings";

const Security = () => {
  const { toast } = useToast();
  const { changePassword } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 30,
    ipWhitelist: false,
    bruteForceProtection: true,
    loginNotifications: true,
  });

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ 
        title: "Greška", 
        description: "Nove lozinke se ne podudaraju",
        variant: "destructive"
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({ 
        title: "Greška", 
        description: "Nova lozinka mora imati najmanje 6 znakova",
        variant: "destructive"
      });
      return;
    }

    const { error } = await changePassword(passwordForm.newPassword);
    
    if (error) {
      toast({ 
        title: "Greška", 
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({ 
        title: "Uspješno", 
        description: "Lozinka je uspješno promijenjena" 
      });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    }
  };

  const securityChecks = [
    { label: "SSL certifikat", status: true, description: "HTTPS je aktivan" },
    { label: "RLS politike", status: true, description: "Row Level Security omogućen" },
    { label: "API autentifikacija", status: true, description: "JWT tokeni aktivni" },
    { label: "Backup konfiguracija", status: false, description: "Automatski backup nije konfiguriran" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="lg:ml-64">
        <Header />
        
        <main className="p-4 lg:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Sigurnost</h2>
            <p className="text-muted-foreground">Upravljanje sigurnosnim postavkama</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Password Change */}
            <div className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Promjena lozinke</h3>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova lozinka</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Potvrdi novu lozinku</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  />
                </div>
                <Button onClick={handlePasswordChange} className="w-full">
                  <Lock className="h-4 w-4 mr-2" />
                  Promijeni lozinku
                </Button>
              </div>
            </div>

            {/* Security Status */}
            <div className="glass rounded-xl p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Status sigurnosti</h3>
              </div>
              
              <div className="space-y-3">
                {securityChecks.map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      {check.status ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{check.label}</p>
                        <p className="text-xs text-muted-foreground">{check.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Settings */}
            <div className="glass rounded-xl p-6 lg:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                  <Lock className="h-5 w-5 text-warning" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Sigurnosne postavke</h3>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label>Dvofaktorska autentifikacija</Label>
                    <p className="text-sm text-muted-foreground">Dodatni sloj zaštite</p>
                  </div>
                  <Switch
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(checked) => setSecuritySettings({...securitySettings, twoFactorEnabled: checked})}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label>Zaštita od brute-force napada</Label>
                    <p className="text-sm text-muted-foreground">Blokiranje nakon više neuspjelih pokušaja</p>
                  </div>
                  <Switch
                    checked={securitySettings.bruteForceProtection}
                    onCheckedChange={(checked) => setSecuritySettings({...securitySettings, bruteForceProtection: checked})}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label>IP Whitelist</Label>
                    <p className="text-sm text-muted-foreground">Dopusti pristup samo s određenih IP adresa</p>
                  </div>
                  <Switch
                    checked={securitySettings.ipWhitelist}
                    onCheckedChange={(checked) => setSecuritySettings({...securitySettings, ipWhitelist: checked})}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <Label>Obavijesti o prijavi</Label>
                    <p className="text-sm text-muted-foreground">Email pri svakoj novoj prijavi</p>
                  </div>
                  <Switch
                    checked={securitySettings.loginNotifications}
                    onCheckedChange={(checked) => setSecuritySettings({...securitySettings, loginNotifications: checked})}
                  />
              </div>
            </div>

            {/* Geo-Blocking */}
            <div className="lg:col-span-2">
              <GeoBlockSettings />
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Security;