import { Channel, type ConfiguredProviderDto, type ProviderCatalogItem } from '@convey/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Key,
  Layers,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../lib/api';
import { providerKeys } from '../lib/queryKeys';

export function ProviderConfigPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'configured' | 'catalog' | 'env'>('configured');
  const [catalogChannel, setCatalogChannel] = useState<string>('ALL');
  const [searchCatalog, setSearchCatalog] = useState('');

  // Register Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ProviderCatalogItem | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState(1);
  const [weight, setWeight] = useState(100);
  const [fallbackProviderId, setFallbackProviderId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  // Test Connection Modal / State
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);

  // Env Export Modal State
  const [isEnvExportOpen, setIsEnvExportOpen] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // TanStack Queries
  const { data: catalog = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: providerKeys.catalog(),
    queryFn: () => api.getProviderCatalog(),
  });

  const {
    data: configured = [],
    isLoading: isConfiguredLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: providerKeys.configured(),
    queryFn: () => api.getConfiguredProviders(),
  });

  const { data: envData } = useQuery({
    queryKey: providerKeys.envExport(),
    queryFn: () => api.exportEnvVariables(),
  });

  // TanStack Mutation: Register Provider
  const registerMutation = useMutation({
    mutationFn: (data: {
      providerId: string;
      channel: Channel;
      credentials: Record<string, string>;
      isPrimary?: boolean;
      priority?: number;
      weight?: number;
      fallbackProviderId?: string;
    }) => api.registerProvider(data),
    onSuccess: (res) => {
      toast.success(`Registered and configured ${res.displayName}!`);
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      setIsRegisterOpen(false);
      setSelectedCatalogItem(null);
      setCredentials({});
      setTestResult(null);
    },
    onError: () => {
      toast.error('Failed to register provider');
    },
  });

  // TanStack Mutation: Delete Provider
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConfiguredProvider(id),
    onSuccess: () => {
      toast.success('Provider configuration deactivated');
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
    },
    onError: () => {
      toast.error('Failed to delete provider');
    },
  });

  // TanStack Mutation: Test Connection
  const testConnMutation = useMutation({
    mutationFn: (vars: { providerId: string; credentials: Record<string, string> }) =>
      api.testProviderConnection(vars.providerId, vars.credentials),
    onSuccess: (res) => {
      setTestResult(res);
      if (res.success) {
        toast.success(`Connection verified: ${res.message} (${res.latencyMs}ms)`);
      } else {
        toast.error(`Connection failed: ${res.message}`);
      }
    },
    onError: () => {
      toast.error('Connection probe failed');
    },
  });

  // Open Registration modal with chosen catalog item
  const handleOpenRegister = (item?: ProviderCatalogItem) => {
    const targetItem = item || catalog[0];
    setSelectedCatalogItem(targetItem);

    // Populate initial default credentials
    const initialCreds: Record<string, string> = {};
    if (targetItem?.requiredEnvVars) {
      for (const spec of targetItem.requiredEnvVars) {
        if (spec.defaultValue) {
          initialCreds[spec.key] = spec.defaultValue;
        }
      }
    }

    setCredentials(initialCreds);
    setPriority(targetItem?.defaultPriority || 1);
    setWeight(targetItem?.defaultWeight || 100);
    setFallbackProviderId('');
    setIsPrimary(true);
    setTestResult(null);
    setIsRegisterOpen(true);
  };

  const handleCatalogSelectChange = (providerId: string) => {
    const item = catalog.find((c) => c.id === providerId);
    if (item) {
      setSelectedCatalogItem(item);
      const initialCreds: Record<string, string> = {};
      for (const spec of item.requiredEnvVars) {
        if (spec.defaultValue) {
          initialCreds[spec.key] = spec.defaultValue;
        }
      }
      setCredentials(initialCreds);
      setPriority(item.defaultPriority);
      setWeight(item.defaultWeight);
      setTestResult(null);
    }
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleTestProbe = () => {
    if (!selectedCatalogItem) return;
    testConnMutation.mutate({
      providerId: selectedCatalogItem.id,
      credentials,
    });
  };

  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogItem) return;

    registerMutation.mutate({
      providerId: selectedCatalogItem.id,
      channel: selectedCatalogItem.channel,
      credentials,
      isPrimary,
      priority,
      weight,
      fallbackProviderId: fallbackProviderId || undefined,
    });
  };

  const handleCopyEnv = () => {
    if (envData?.envFileContent) {
      navigator.clipboard.writeText(envData.envFileContent);
      setCopiedEnv(true);
      toast.success('Environment variables (.env) copied to clipboard');
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  const handleDownloadEnv = () => {
    if (!envData?.envFileContent) return;
    const blob = new Blob([envData.envFileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env.convey';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded .env.convey configuration file');
  };

  const filteredCatalog = catalog.filter((item) => {
    const matchesChannel = catalogChannel === 'ALL' || item.channel === catalogChannel;
    const matchesSearch =
      item.displayName.toLowerCase().includes(searchCatalog.toLowerCase()) ||
      item.id.toLowerCase().includes(searchCatalog.toLowerCase()) ||
      item.description.toLowerCase().includes(searchCatalog.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-400" />
              Provider Registration & Configuration Studio
            </h1>
            <Badge variant="cyan" dot>
              88+ Turnkey Ecosystem
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Register provider credentials, configure priority weights & fallback chains, test live connection probes,
            and generate `.env` vaults.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEnvExportOpen(true)}
            className="text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Export .env Vault</span>
          </Button>

          <Button variant="glow" size="sm" onClick={() => handleOpenRegister()} className="text-xs gap-1.5 font-bold">
            <Plus className="w-3.5 h-3.5" />
            <span>Register Provider</span>
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Configured Adapters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">{configured.length} Active</div>
            <p className="text-[11px] text-slate-400 mt-1">Ready for Outbound Dispatch</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Turnkey Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-400">88 Providers</div>
            <p className="text-[11px] text-slate-400 mt-1">5 Core Channels Supported</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Failover Redundancy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-indigo-400">100% Guaranteed</div>
            <p className="text-[11px] text-slate-400 mt-1">Automatic Waterfall Fallback</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Vault Security</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>AES-256-GCM</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">BYOK KMS Enveloped Storage</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'configured' | 'catalog' | 'env')}>
        <TabsList className="bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="configured" className="text-xs font-semibold gap-1.5">
            <Server className="w-3.5 h-3.5" />
            <span>Configured Providers ({configured.length})</span>
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs font-semibold gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Turnkey Catalog (88 Available)</span>
          </TabsTrigger>
          <TabsTrigger value="env" className="text-xs font-semibold gap-1.5">
            <Code2 className="w-3.5 h-3.5" />
            <span>Environment Variable Vault</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Configured Providers */}
        <TabsContent value="configured" className="space-y-4 pt-2">
          <Card className="glass-panel overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Provider Configurations & Fallback Routing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Priority & Weight</TableHead>
                    <TableHead>Failover Target</TableHead>
                    <TableHead>Credentials Mask</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isConfiguredLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                        Loading configurations...
                      </TableCell>
                    </TableRow>
                  ) : configured.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        No providers configured yet. Click "Register Provider" or select from the Catalog!
                      </TableCell>
                    </TableRow>
                  ) : (
                    configured.map((p: ConfiguredProviderDto) => (
                      <TableRow key={p.id} className="group">
                        <TableCell>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>{p.displayName}</span>
                              {p.isPrimary && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-semibold">
                                  Primary
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{p.providerId}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="cyan">{p.channel}</Badge>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-slate-300">
                          <span>Tier #{p.priority}</span> • <span className="text-emerald-400">{p.weight}% Load</span>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-slate-400">
                          {p.fallbackProviderId ? (
                            <span className="text-indigo-300">➔ {p.fallbackProviderId}</span>
                          ) : (
                            <span className="text-slate-500">None (Terminal)</span>
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-slate-400">
                          {Object.entries(p.credentialsMasked).map(([k, v]) => (
                            <div key={k} className="text-[11px] truncate max-w-xs">
                              <span className="text-slate-500">{k}: </span>
                              <span className="text-slate-300">{v}</span>
                            </div>
                          ))}
                        </TableCell>

                        <TableCell>
                          <Badge variant={p.status === 'ACTIVE' ? 'success' : 'destructive'} dot>
                            {p.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right space-x-2">
                          {/* Test Connection Probe */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const catalogItem = catalog.find((c) => c.id === p.providerId);
                              handleOpenRegister(catalogItem);
                            }}
                            className="h-7 text-xs gap-1 hover:border-sky-500/40"
                            title="Edit or Test Connection"
                          >
                            <Sliders className="w-3 h-3 text-sky-400" />
                            <span>Edit</span>
                          </Button>

                          {/* Delete Provider */}
                          <Button
                            variant="ghost"
                            size="sm"
                            isLoading={deleteMutation.isPending && deleteMutation.variables === p.id}
                            onClick={() => deleteMutation.mutate(p.id)}
                            className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            title="Deactivate Provider"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Turnkey Provider Catalog */}
        <TabsContent value="catalog" className="space-y-4 pt-2">
          {/* Catalog Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {['ALL', Channel.EMAIL, Channel.SMS, Channel.WHATSAPP, Channel.PUSH, Channel.SLACK, Channel.TOOL].map(
                (chan) => (
                  <Button
                    key={chan}
                    variant={catalogChannel === chan ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setCatalogChannel(chan)}
                    className="text-xs font-semibold"
                  >
                    {chan}
                  </Button>
                ),
              )}
            </div>

            <div className="w-72">
              <Input
                placeholder="Search catalog by name or keyword..."
                value={searchCatalog}
                onChange={(e) => setSearchCatalog(e.target.value)}
                icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
              />
            </div>
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isCatalogLoading ? (
              <div className="col-span-full py-16 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                <span>Loading 88+ turnkey adapters catalog...</span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500">
                No providers match the search criteria.
              </div>
            ) : (
              filteredCatalog.map((item) => {
                const isConfigured = configured.some((c) => c.providerId === item.id);

                return (
                  <Card
                    key={item.id}
                    className="glass-panel flex flex-col justify-between hover:border-slate-700 transition-all group"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{item.displayName}</span>
                          </CardTitle>
                          <span className="text-[10px] font-mono text-slate-400">{item.id}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="cyan">{item.channel}</Badge>
                          {isConfigured && (
                            <Badge variant="success" dot>
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-xs text-slate-300 mt-2 line-clamp-2">
                        {item.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Required Env Variables:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item.requiredEnvVars.map((v) => (
                            <span
                              key={v.key}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                              title={v.description}
                            >
                              {v.key}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                        {item.docsUrl ? (
                          <a
                            href={item.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                          >
                            <span>Docs</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <div />
                        )}

                        <Button
                          variant={isConfigured ? 'secondary' : 'glow'}
                          size="sm"
                          onClick={() => handleOpenRegister(item)}
                          className="text-xs gap-1.5 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isConfigured ? 'Reconfigure' : 'Configure & Register'}</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* TAB 3: Environment Variable Vault */}
        <TabsContent value="env" className="space-y-4 pt-2">
          <Card className="glass-panel">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  Convey Auto-Generated Environment Variable Vault (.env)
                </CardTitle>
                <CardDescription>
                  Unified environment variables for all active communication adapters. Copy directly to your deployment
                  secrets or CI/CD pipelines.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadEnv} className="text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .env</span>
                </Button>
                <Button variant="glow" size="sm" onClick={handleCopyEnv} className="text-xs gap-1.5 font-bold">
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? 'Copied!' : 'Copy .env'}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative p-4 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-[480px] overflow-y-auto leading-relaxed shadow-inner">
                {envData?.envFileContent || '# No environment variables configured yet.'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: Provider Registration & Credential Setup Wizard */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmitRegistration}>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle>Configure & Register Provider</DialogTitle>
                  <DialogDescription>
                    Configure API credentials, load weight, and live connection test for this messaging adapter.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Select Provider from Catalog */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Select Provider Adapter</label>
                <Select
                  value={selectedCatalogItem?.id || ''}
                  onChange={(e) => handleCatalogSelectChange(e.target.value)}
                >
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} ({item.channel})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Dynamic Credential Inputs based on Provider Spec */}
              {selectedCatalogItem && (
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>API Credentials & Environment Keys</span>
                    </span>
                    <Badge variant="cyan">{selectedCatalogItem.channel}</Badge>
                  </div>

                  {selectedCatalogItem.requiredEnvVars.map((spec) => (
                    <div key={spec.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <label className="font-semibold text-slate-300">
                          {spec.label} {spec.required && <span className="text-rose-400">*</span>}
                        </label>
                        <span className="font-mono text-[10px] text-slate-400">{spec.key}</span>
                      </div>
                      <Input
                        type={spec.isSecret ? 'password' : 'text'}
                        placeholder={spec.placeholder}
                        value={credentials[spec.key] || ''}
                        onChange={(e) => handleCredentialChange(spec.key, e.target.value)}
                        required={spec.required}
                      />
                      <p className="text-[11px] text-slate-400">{spec.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Routing Priority & Load Weight Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority Tier */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-300">Routing Priority Tier</span>
                    <span className="font-mono text-sky-400 font-bold">Tier #{priority}</span>
                  </div>
                  <Slider value={priority} min={1} max={5} step={1} onValueChange={setPriority} />
                  <p className="text-[10px] text-slate-400">1 = Primary fast-path, 5 = Deep fallback</p>
                </div>

                {/* Load Weight */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-300">Traffic Load Share</span>
                    <span className="font-mono text-emerald-400 font-bold">{weight}%</span>
                  </div>
                  <Slider value={weight} min={10} max={100} step={5} onValueChange={setWeight} />
                  <p className="text-[10px] text-slate-400">Traffic distribution across same priority tier</p>
                </div>
              </div>

              {/* Failover Target Provider */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Automatic Failover Target</label>
                <Select value={fallbackProviderId} onChange={(e) => setFallbackProviderId(e.target.value)}>
                  <option value="">None (Terminal on Failure)</option>
                  {catalog
                    .filter((c) => c.channel === selectedCatalogItem?.channel && c.id !== selectedCatalogItem?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.id})
                      </option>
                    ))}
                </Select>
              </div>

              {/* Live Connection Test Probe Bar */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Validate Credentials Probe</span>
                  <span className="text-[11px] text-slate-400">
                    Sends an authenticated ping to verify credentials without sending messages.
                  </span>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={testConnMutation.isPending}
                  onClick={handleTestProbe}
                  className="text-xs gap-1.5 font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Test Connection</span>
                </Button>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>{testResult.message}</span>
                  </div>
                  <span className="font-mono font-bold text-xs">{testResult.latencyMs}ms</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" size="sm" isLoading={registerMutation.isPending}>
                Save & Activate Provider
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Full Environment Export */}
      <Dialog open={isEnvExportOpen} onOpenChange={setIsEnvExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export Complete .env Configuration Vault</DialogTitle>
            <DialogDescription>
              Copy these environment variables to your `.env` file or cloud secrets manager (AWS Secrets Manager, GCP
              Secret Manager, Vault).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed shadow-inner">
              {envData?.envFileContent}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadEnv} className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </Button>
            <Button variant="glow" size="sm" onClick={handleCopyEnv} className="gap-1.5 font-bold">
              {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEnv ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
