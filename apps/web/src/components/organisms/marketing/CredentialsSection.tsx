"use client";

import { useState } from "react";
import { Key, Eye, EyeOff, Plus, Trash2, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/molecules/buttons/Button";
import { BaseInput } from "@/components/atoms/inputs/BaseInput";
import { BaseLabel } from "@/components/atoms/inputs/BaseLabel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/atoms/layout/Dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/atoms/inputs/BaseSelect";
import { marketingRepository } from "@/lib/api/repositories";
import { useAuth } from "@/contexts/AuthContext";
import type { MarketingCredential } from "@/lib/types/marketing";

interface CredentialsSectionProps {
  credentials: MarketingCredential[];
  productId: string;
}

const CREDENTIAL_TYPES = [
  { value: "login", label: "Login" },
  { value: "api_key", label: "API Key" },
  { value: "oauth", label: "OAuth" },
  { value: "ssh", label: "SSH Key" },
  { value: "other", label: "Other" },
];

export function CredentialsSection({ credentials, productId }: CredentialsSectionProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [credType, setCredType] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState("");

  const createMutation = useMutation({
    mutationFn: () => marketingRepository.createCredential({
      product_id: productId,
      created_by: user?.profile_id ?? user?.id ?? "",
      label, credential_type: credType,
      username: username || undefined, email: email || undefined,
      password: password || undefined, additional_info: info || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-credentials", productId] });
      toast.success("Credential added");
      setAddOpen(false);
      setLabel(""); setCredType("login"); setUsername(""); setEmail(""); setPassword(""); setInfo("");
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketingRepository.deleteCredential(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-credentials", productId] });
      toast.success("Credential deleted");
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Securely stored credentials for this project</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Credential
        </Button>
      </div>

      {credentials.length === 0 ? (
        <div className="text-center py-8">
          <Key className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No credentials stored yet</p>
        </div>
      ) : (
        credentials.map((c) => (
          <CredentialRow key={c.id} credential={c} onDelete={(id) => deleteMutation.mutate(id)} />
        ))
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Credential</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <div><BaseLabel>Label</BaseLabel><BaseInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. AWS Console, Stripe Dashboard" required /></div>
            <div>
              <BaseLabel>Type</BaseLabel>
              <Select value={credType} onValueChange={setCredType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CREDENTIAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><BaseLabel>Username</BaseLabel><BaseInput value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Optional" /></div>
            <div><BaseLabel>Email</BaseLabel><BaseInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" /></div>
            <div><BaseLabel>Password / Secret</BaseLabel><BaseInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Will be encrypted" /></div>
            <div><BaseLabel>Additional Info</BaseLabel><BaseInput value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Notes, URLs, etc." /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!label || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialRow({ credential, onDelete }: { credential: MarketingCredential; onDelete: (id: string) => void }) {
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTogglePassword = async () => {
    if (showPassword) {
      setShowPassword(false);
      return;
    }
    if (decryptedPassword !== null) {
      setShowPassword(true);
      return;
    }
    setLoading(true);
    try {
      const result = await marketingRepository.decryptCredential(credential.id);
      setDecryptedPassword(result.password);
      setShowPassword(true);
    } catch {
      toast.error("Failed to decrypt password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3 group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{credential.label}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{credential.credential_type}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {credential.username && <span>User: <span className="font-mono">{credential.username}</span></span>}
          {credential.email && <span>Email: {credential.email}</span>}
          {showPassword && decryptedPassword && (
            <span>Password: <span className="font-mono bg-secondary px-1 rounded">{decryptedPassword}</span></span>
          )}
        </div>
        {credential.additional_info && <p className="text-[10px] text-muted-foreground mt-1">{credential.additional_info}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {credential.password_encrypted && (
          <button onClick={handleTogglePassword} className="p-1.5 rounded hover:bg-accent" title={showPassword ? "Hide" : "Reveal"}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : showPassword ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        )}
        <button onClick={() => onDelete(credential.id)} className="p-1.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}
