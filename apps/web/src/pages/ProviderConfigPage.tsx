import {
  Channel,
  COMPLETE_88_PROVIDER_CATALOG,
  type ConfiguredProviderDto,
  type ProviderCatalogItem,
  type ProviderFeatureConfigs,
} from '@convey/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Code2,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
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
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Combobox, type ComboboxGroup, type ComboboxItem } from '../components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { providerKeys } from '../lib/queryKeys';

// Full 88 Turnkey Provider Catalog
const FALLBACK_CATALOG = COMPLETE_88_PROVIDER_CATALOG;

export function ProviderConfigPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'configured' | 'catalog' | 'env'>('configured');
  const [catalogChannel, setCatalogChannel] = useState<string>('ALL');
  const [searchCatalog, setSearchCatalog] = useState('');

  // Register Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ProviderCatalogItem | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConfiguredProviderDto | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [priority, setPriority] = useState(1);
  const [weight, setWeight] = useState(100);
  const [fallbackProviderId, setFallbackProviderId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  // Copy tracking states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Advanced Feature Configs State
  const [featureConfigs, setFeatureConfigs] = useState<ProviderFeatureConfigs>({
    whatsapp: {
      costSaving24hSession: true,
      autoTemplateValidation: true,
      interactiveButtons: true,
    },
    email: {
      openTracking: true,
      clickTracking: true,
      tlsPolicy: 'REQUIRE',
      sandboxMode: false,
    },
    sms: {
      smartGsmPacking: true,
      dlrTimeoutSeconds: 30,
      alphanumericSenderId: true,
      shortUrlTracking: true,
    },
    push: {
      fcmHighPriority: true,
      timeToLiveSeconds: 86400,
      badgeIncrement: true,
    },
    slack: {
      unfurlLinks: true,
      unfurlMedia: true,
      mrkdwn: true,
    },
  });

  // Modal Inner Tab (Credentials vs Features vs Routing)
  const [modalTab, setModalTab] = useState<'creds' | 'features' | 'routing'>('creds');

  // Test Connection Modal / State
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);

  // Env Export Modal State
  const [isEnvExportOpen, setIsEnvExportOpen] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // TanStack Queries
  const { data: serverCatalog = [], isLoading: isCatalogLoading } = useQuery({
    queryKey: providerKeys.catalog(),
    queryFn: () => api.getProviderCatalog(),
  });

  const { data: configured = [], isLoading: isConfiguredLoading } = useQuery({
    queryKey: providerKeys.configured(),
    queryFn: () => api.getConfiguredProviders(),
  });

  const { data: envData } = useQuery({
    queryKey: providerKeys.envExport(),
    queryFn: () => api.exportEnvVariables(),
  });

  // Merge server catalog with fallback catalog
  const effectiveCatalog = useMemo(() => {
    return serverCatalog.length > 0 ? serverCatalog : FALLBACK_CATALOG;
  }, [serverCatalog]);

  // Ensure selectedCatalogItem is always populated
  useEffect(() => {
    if (!selectedCatalogItem && effectiveCatalog.length > 0) {
      const defaultItem = effectiveCatalog.find((c) => c.id === 'sendgrid') || effectiveCatalog[0];
      setSelectedCatalogItem(defaultItem);
      const initialCreds: Record<string, string> = {};
      for (const spec of defaultItem.requiredEnvVars) {
        if (spec.defaultValue) {
          initialCreds[spec.key] = spec.defaultValue;
        }
      }
      setCredentials(initialCreds);
    }
  }, [effectiveCatalog, selectedCatalogItem]);

  // TanStack Mutation: Register Provider
  const registerMutation = useMutation({
    mutationFn: (data: {
      providerId: string;
      channel: Channel;
      credentials: Record<string, string>;
      config?: ProviderFeatureConfigs;
      isPrimary?: boolean;
      priority?: number;
      weight?: number;
      fallbackProviderId?: string;
    }) => api.registerProvider(data),
    onSuccess: (res) => {
      toast.success(`Registered and configured ${res.displayName} in database!`);
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      setIsRegisterOpen(false);
      setTestResult(null);
    },
    onError: () => {
      toast.error('Failed to register provider');
    },
  });

  // TanStack Mutation: Seed All 88 Providers
  const seedAllMutation = useMutation({
    mutationFn: () => api.seedAllProviders(),
    onSuccess: (res) => {
      toast.success(
        `Successfully populated and seeded ${res.totalSeeded} turnkey communication providers in PostgreSQL!`,
      );
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
    },
    onError: () => {
      toast.error('Failed to seed providers');
    },
  });

  // TanStack Mutation: Delete Provider
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConfiguredProvider(id),
    onSuccess: () => {
      toast.success('Provider configuration deactivated from database');
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
  const handleOpenRegister = (item?: ProviderCatalogItem, existingConfig?: ConfiguredProviderDto) => {
    const targetItem =
      item || selectedCatalogItem || effectiveCatalog.find((c) => c.id === 'sendgrid') || effectiveCatalog[0];
    setSelectedCatalogItem(targetItem);
    setEditingConfig(existingConfig || null);

    // Populate initial credentials
    const initialCreds: Record<string, string> = {};
    if (existingConfig?.credentialsMasked) {
      for (const k of Object.keys(existingConfig.credentialsMasked)) {
        initialCreds[k] = ''; // Blank indicates keep existing secret
      }
    } else if (targetItem?.requiredEnvVars) {
      for (const spec of targetItem.requiredEnvVars) {
        if (spec.defaultValue) {
          initialCreds[spec.key] = spec.defaultValue;
        }
      }
    }

    setCredentials(initialCreds);
    setVisibleSecrets({});
    setPriority(existingConfig?.priority || targetItem?.defaultPriority || 1);
    setWeight(existingConfig?.weight || targetItem?.defaultWeight || 100);
    setFallbackProviderId(existingConfig?.fallbackProviderId || '');
    setIsPrimary(existingConfig?.isPrimary ?? true);
    if (existingConfig?.config) {
      setFeatureConfigs(existingConfig.config);
    }
    setModalTab('creds');
    setTestResult(null);
    setIsRegisterOpen(true);
  };

  const handleCatalogSelectChange = (providerId: string) => {
    const item = effectiveCatalog.find((c) => c.id === providerId);
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
      config: featureConfigs,
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

  const CHANNEL_CATEGORIES = useMemo(
    () => [
      { key: 'ALL', label: t('messages.allChannels'), count: effectiveCatalog.length },
      {
        key: 'EMAIL',
        label: t('common.email'),
        count: effectiveCatalog.filter((c) => c.channel === Channel.EMAIL).length,
      },
      { key: 'SMS', label: t('common.sms'), count: effectiveCatalog.filter((c) => c.channel === Channel.SMS).length },
      {
        key: 'PUSH',
        label: t('common.push'),
        count: effectiveCatalog.filter((c) => c.channel === Channel.PUSH).length,
      },
      {
        key: 'CHAT',
        label: t('common.chat'),
        count: effectiveCatalog.filter(
          (c) => c.channel === Channel.CHAT || c.channel === Channel.WHATSAPP || c.channel === Channel.SLACK,
        ).length,
      },
      {
        key: 'TOOL',
        label: t('common.tool'),
        count: effectiveCatalog.filter((c) => c.channel === Channel.TOOL).length,
      },
    ],
    [effectiveCatalog, t],
  );

  const filteredCatalog = effectiveCatalog.filter((item) => {
    let matchesChannel = true;
    if (catalogChannel === 'EMAIL') matchesChannel = item.channel === Channel.EMAIL;
    else if (catalogChannel === 'SMS') matchesChannel = item.channel === Channel.SMS;
    else if (catalogChannel === 'PUSH') matchesChannel = item.channel === Channel.PUSH;
    else if (catalogChannel === 'CHAT') {
      matchesChannel =
        item.channel === Channel.CHAT || item.channel === Channel.WHATSAPP || item.channel === Channel.SLACK;
    } else if (catalogChannel === 'TOOL') {
      matchesChannel = item.channel === Channel.TOOL;
    }

    const query = searchCatalog.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.displayName.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.requiredEnvVars.some((v) => v.key.toLowerCase().includes(query));

    return matchesChannel && matchesSearch;
  });

  // Grouped Combobox items for searchable autocomplete
  const comboboxGroups = useMemo<ComboboxGroup[]>(() => {
    const email = effectiveCatalog.filter((c) => c.channel === Channel.EMAIL);
    const sms = effectiveCatalog.filter((c) => c.channel === Channel.SMS);
    const push = effectiveCatalog.filter((c) => c.channel === Channel.PUSH);
    const chat = effectiveCatalog.filter(
      (c) => c.channel === Channel.CHAT || c.channel === Channel.WHATSAPP || c.channel === Channel.SLACK,
    );
    const tool = effectiveCatalog.filter((c) => c.channel === Channel.TOOL);

    const mapItem = (item: ProviderCatalogItem): ComboboxItem => ({
      value: item.id,
      label: item.displayName,
      sublabel: item.id,
      badge: item.channel,
      badgeVariant:
        item.channel === Channel.EMAIL
          ? 'cyan'
          : item.channel === Channel.SMS
            ? 'purple'
            : item.channel === Channel.PUSH
              ? 'warning'
              : item.channel === Channel.TOOL
                ? 'default'
                : 'success',
      keywords: [item.description, ...item.requiredEnvVars.map((v) => v.key)],
    });

    return [
      { label: `📧 Email Providers (${email.length})`, categoryKey: 'EMAIL', items: email.map(mapItem) },
      { label: `📱 SMS Carriers & Gateways (${sms.length})`, categoryKey: 'SMS', items: sms.map(mapItem) },
      { label: `🔔 Push Notification Providers (${push.length})`, categoryKey: 'PUSH', items: push.map(mapItem) },
      { label: `💬 Chat & Instant Messaging (${chat.length})`, categoryKey: 'CHAT', items: chat.map(mapItem) },
      { label: `🛠️ Incident & Alerting Tools (${tool.length})`, categoryKey: 'TOOL', items: tool.map(mapItem) },
    ];
  }, [effectiveCatalog]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              {t('providerConfig.title')}
            </h1>
            <Badge variant="cyan" dot>
              PostgreSQL Persisted
            </Badge>
            <Badge variant="purple">{effectiveCatalog.length} Turnkey Adapters</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('providerConfig.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            isLoading={seedAllMutation.isPending}
            onClick={() => seedAllMutation.mutate()}
            className="text-xs gap-1.5 border-sky-500/40 text-sky-600 dark:text-sky-300 hover:bg-sky-500/10"
            title="Seed all 88 turnkey communication adapters with sandbox credentials into PostgreSQL"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>Seed All 88 Providers</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEnvExportOpen(true)}
            className="text-xs gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{t('providerConfig.tabEnv')}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenRegister()}
            className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('providerConfig.registerProvider')}</span>
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('providerConfig.tabConfigured')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {configured.length} Persisted
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Stored in Postgres `providers` Table</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('overview.kpiCostSaved')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('common.active')}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Saves ~$0.05/msg on Active Sessions</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('providerConfig.catalogTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {effectiveCatalog.length} Adapters
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Multi-Channel Turnkey Ecosystem</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('providerConfig.tabEnv')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>AES-256-GCM</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{t('providerConfig.masked')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'configured' | 'catalog' | 'env')}>
        <TabsList className="bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="configured" className="text-xs font-semibold gap-1.5">
            <Server className="w-3.5 h-3.5" />
            <span>
              {t('providerConfig.tabConfigured')} ({configured.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs font-semibold gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>
              {t('providerConfig.tabCatalog')} ({effectiveCatalog.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="env" className="text-xs font-semibold gap-1.5">
            <Code2 className="w-3.5 h-3.5" />
            <span>{t('providerConfig.tabEnv')}</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Configured Providers */}
        <TabsContent value="configured" className="space-y-4 pt-2">
          <Card className="glass-panel overflow-hidden">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('providerConfig.tableLedgerTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('providers.colProvider')}</TableHead>
                    <TableHead>{t('common.channel')}</TableHead>
                    <TableHead>{t('providerConfig.colActiveConfigs')}</TableHead>
                    <TableHead>{t('providerConfig.colPriorityLoad')}</TableHead>
                    <TableHead>{t('providerConfig.fallbackProviderLabel')}</TableHead>
                    <TableHead>{t('providerConfig.masked')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="text-end rtl:text-left">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isConfiguredLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  ) : configured.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        {t('providerConfig.noConfiguredProviders')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    configured.map((p: ConfiguredProviderDto) => {
                      const cfg = p.config as ProviderFeatureConfigs | undefined;

                      return (
                        <TableRow key={p.id} className="group">
                          <TableCell>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{p.displayName}</span>
                                {p.isPrimary && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-semibold">
                                    {t('providerConfig.primaryBadge')}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {p.providerId}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="cyan">{p.channel}</Badge>
                          </TableCell>

                          {/* Active Feature Config Badges */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.channel === Channel.WHATSAPP && cfg?.whatsapp?.costSaving24hSession && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                  24h Cost Saver
                                </span>
                              )}
                              {p.channel === Channel.EMAIL && cfg?.email?.openTracking && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-mono">
                                  Open Track
                                </span>
                              )}
                              {p.channel === Channel.EMAIL && cfg?.email?.clickTracking && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-mono">
                                  Click Track
                                </span>
                              )}
                              {p.channel === Channel.SMS && cfg?.sms?.smartGsmPacking && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-mono">
                                  Smart GSM-7
                                </span>
                              )}
                              {p.channel === Channel.PUSH && cfg?.push?.fcmHighPriority && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono">
                                  High Priority
                                </span>
                              )}
                              {p.channel === Channel.SLACK && cfg?.slack?.unfurlLinks && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-mono">
                                  Unfurl Media
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                            <span>#{p.priority}</span> •{' '}
                            <span className="text-emerald-600 dark:text-emerald-400">{p.weight}%</span>
                          </TableCell>

                          <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {p.fallbackProviderId ? (
                              <span className="text-indigo-600 dark:text-indigo-300">➔ {p.fallbackProviderId}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">
                                {t('providerConfig.noneTerminal')}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            <div className="space-y-1 max-w-xs">
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400/90 font-sans font-medium">
                                <Lock className="w-2.5 h-2.5" />
                                <span>AES-256-GCM</span>
                              </div>
                              {Object.entries(p.credentialsMasked || {}).map(([k, v]) => (
                                <div
                                  key={k}
                                  className="flex items-center justify-between gap-1 text-[11px] bg-slate-100 dark:bg-slate-950/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800"
                                >
                                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[100px]" title={k}>
                                    {k}:
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-300 font-mono tracking-wider">
                                    {v}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(v);
                                      setCopiedKey(`${p.id}:${k}`);
                                      toast.success(`Copied masked ${k} identifier`);
                                      setTimeout(() => setCopiedKey(null), 2000);
                                    }}
                                    className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-0.5 transition-colors cursor-pointer"
                                    title="Copy masked identifier"
                                  >
                                    {copiedKey === `${p.id}:${k}` ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant={p.status === 'ACTIVE' ? 'success' : 'destructive'} dot>
                              {p.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-end rtl:text-left space-x-2 rtl:space-x-reverse">
                            {/* Edit / Config */}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const catalogItem = effectiveCatalog.find((c) => c.id === p.providerId);
                                handleOpenRegister(catalogItem, p);
                              }}
                              className="h-7 text-xs gap-1 hover:border-sky-500/40"
                              title="Edit Credentials & Feature Configs"
                            >
                              <Sliders className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                              <span>{t('providerConfig.configButton')}</span>
                            </Button>

                            {/* Delete Provider */}
                            <Button
                              variant="ghost"
                              size="sm"
                              isLoading={deleteMutation.isPending && deleteMutation.variables === p.id}
                              onClick={() => deleteMutation.mutate(p.id)}
                              className="h-7 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10"
                              title="Deactivate Provider"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Turnkey Provider Catalog */}
        <TabsContent value="catalog" className="space-y-4 pt-2">
          {/* Catalog Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex flex-wrap gap-1.5">
              {CHANNEL_CATEGORIES.map((cat) => (
                <Button
                  key={cat.key}
                  variant={catalogChannel === cat.key ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setCatalogChannel(cat.key)}
                  className="text-xs font-semibold gap-1.5 h-8"
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      catalogChannel === cat.key
                        ? 'bg-sky-500 dark:bg-sky-400/30 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                isLoading={seedAllMutation.isPending}
                onClick={() => seedAllMutation.mutate()}
                className="text-xs gap-1.5 h-8 border-sky-500/40 text-sky-300 hover:bg-sky-500/10 font-semibold"
                title="Seed all 88 turnkey communication adapters with sandbox credentials into PostgreSQL"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('providerConfig.seedAllButton', { count: effectiveCatalog.length })}</span>
              </Button>

              <div className="w-72">
                <Input
                  placeholder={t('providerConfig.searchPlaceholder')}
                  value={searchCatalog}
                  onChange={(e) => setSearchCatalog(e.target.value)}
                  icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isCatalogLoading && effectiveCatalog.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-400" />
                <span>{t('common.loading')}</span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500">{t('common.noResults')}</div>
            ) : (
              filteredCatalog.map((item) => {
                const isConfigured = configured.some((c) => c.providerId === item.id);

                return (
                  <Card
                    key={item.id}
                    className="glass-panel flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{item.displayName}</span>
                          </CardTitle>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{item.id}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="cyan">{item.channel}</Badge>
                          {isConfigured && (
                            <Badge variant="success" dot>
                              {t('providerConfig.activeInDb')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                        {item.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          {t('providerConfig.requiredEnvVars')}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item.requiredEnvVars.map((v) => (
                            <span
                              key={v.key}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                              title={v.description}
                            >
                              {v.key}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        {item.docsUrl ? (
                          <a
                            href={item.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center gap-1"
                          >
                            <span>{t('providerConfig.docsLink')}</span>
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
                          <span>
                            {isConfigured ? t('providerConfig.configButton') : t('providerConfig.registerAndSetup')}
                          </span>
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
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>{t('providerConfig.envVaultTitle')}</span>
                  <Badge variant="success" className="text-[10px] gap-1 py-0 font-mono">
                    <Lock className="w-2.5 h-2.5" />
                    <span>AES-256-GCM Vault</span>
                  </Badge>
                </CardTitle>
                <CardDescription>{t('providerConfig.envVaultDesc')}</CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadEnv} className="text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('providerConfig.downloadEnv')}</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopyEnv}
                  className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? t('common.copied') : t('providerConfig.copyEnv')}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap max-h-[480px] overflow-y-auto leading-relaxed shadow-inner">
                {envData?.envFileContent || '# No environment variables configured yet.'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: Provider Registration & Multi-Tab Config Wizard */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleSubmitRegistration}>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-inner">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle>{t('providerConfig.modalTitle')}</DialogTitle>
                  <DialogDescription>{t('providerConfig.modalSubtitle')}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Select Provider from Catalog with Search & Autocomplete */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('providerConfig.selectProviderLabel')}
                  </label>
                  <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                    {effectiveCatalog.length} Turnkey Adapters
                  </span>
                </div>
                <Combobox
                  groups={comboboxGroups}
                  value={selectedCatalogItem?.id || ''}
                  onChange={handleCatalogSelectChange}
                  placeholder="Select or search provider adapter..."
                  searchPlaceholder="Search 88 providers by name, id, or env variables..."
                />
              </div>

              {/* Sub-Tabs for Modal: Credentials, Features/Cost-Savings, Routing */}
              <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'creds' | 'features' | 'routing')}>
                <TabsList className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl grid grid-cols-3">
                  <TabsTrigger value="creds" className="text-xs font-semibold gap-1.5">
                    <Key className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                    <span>Credentials (.env)</span>
                  </TabsTrigger>
                  <TabsTrigger value="features" className="text-xs font-semibold gap-1.5">
                    <Zap className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                    <span>Feature Configs</span>
                  </TabsTrigger>
                  <TabsTrigger value="routing" className="text-xs font-semibold gap-1.5">
                    <Sliders className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                    <span>Routing & Failover</span>
                  </TabsTrigger>
                </TabsList>

                {/* SUB-TAB 1: Credentials & Env Setup */}
                <TabsContent value="creds" className="space-y-3 pt-3">
                  {selectedCatalogItem && (
                    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 shadow-inner">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {selectedCatalogItem.displayName} API Keys
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="cyan">{selectedCatalogItem.channel}</Badge>
                          <Badge variant="success" className="text-[10px] gap-1 py-0 font-mono">
                            <Lock className="w-2.5 h-2.5" />
                            <span>AES-256-GCM</span>
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400">{selectedCatalogItem.description}</p>

                      {editingConfig && (
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                          <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            Existing credentials for <strong>{editingConfig.displayName}</strong> are encrypted at rest.
                            Leave blank or keep masked placeholders to retain existing secrets.
                          </span>
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        {selectedCatalogItem.requiredEnvVars.map((spec) => {
                          const isSecret = spec.isSecret ?? true;
                          const isVisible = visibleSecrets[spec.key] ?? false;
                          const maskedPlaceholder = editingConfig?.credentialsMasked?.[spec.key];

                          return (
                            <div key={spec.key} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <span>{spec.label}</span>
                                  {spec.required && !editingConfig && <span className="text-rose-500">*</span>}
                                  {isSecret && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-slate-700">
                                      Encrypted
                                    </span>
                                  )}
                                </label>
                                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                  {spec.key}
                                </span>
                              </div>

                              <div className="relative flex items-center">
                                <Input
                                  type={isSecret && !isVisible ? 'password' : 'text'}
                                  placeholder={
                                    maskedPlaceholder
                                      ? `${maskedPlaceholder} (Leave blank to keep existing)`
                                      : spec.placeholder
                                  }
                                  value={credentials[spec.key] || ''}
                                  onChange={(e) => handleCredentialChange(spec.key, e.target.value)}
                                  required={spec.required && !editingConfig}
                                  className="pr-10 font-mono text-xs"
                                />
                                {isSecret && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleSecrets((prev) => ({
                                        ...prev,
                                        [spec.key]: !prev[spec.key],
                                      }))
                                    }
                                    className="absolute right-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                                    title={isVisible ? 'Hide secret' : 'Reveal secret'}
                                  >
                                    {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">{spec.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Live Connection Test Probe */}
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Validate Credentials Probe
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
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
                      <Sparkles className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                      <span>Test Connection</span>
                    </Button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        testResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>{testResult.message}</span>
                      </div>
                      <span className="font-mono font-bold text-xs">{testResult.latencyMs}ms</span>
                    </div>
                  )}
                </TabsContent>

                {/* SUB-TAB 2: Advanced Feature Configs & WhatsApp Cost Saver */}
                <TabsContent value="features" className="space-y-3 pt-3">
                  {/* WHATSAPP SPECIFIC CONFIGS */}
                  {selectedCatalogItem?.channel === Channel.WHATSAPP && (
                    <div className="space-y-3">
                      {/* WhatsApp 24h Session Cost Saver */}
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              24-Hour Interactive Session Cost Saver
                            </span>
                          </div>
                          <Switch
                            checked={featureConfigs.whatsapp?.costSaving24hSession ?? true}
                            onCheckedChange={(checked) =>
                              setFeatureConfigs((prev) => ({
                                ...prev,
                                whatsapp: { ...prev.whatsapp, costSaving24hSession: checked },
                              }))
                            }
                          />
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          Automatically converts pre-approved template messages to zero-cost plain text when user is
                          within the 24-hour service conversation window. Saves up to **$0.05 per message** on Meta
                          conversation charges.
                        </p>
                      </div>

                      {/* Auto Template Parameter Validation */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Auto-Template Validation
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Validates parameter placeholders before Graph API transmission.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.whatsapp?.autoTemplateValidation ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              whatsapp: { ...prev.whatsapp, autoTemplateValidation: checked },
                            }))
                          }
                        />
                      </div>

                      {/* Interactive CTA Buttons */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Interactive Reply Buttons
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Renders native quick-reply and URL action buttons in chat.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.whatsapp?.interactiveButtons ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              whatsapp: { ...prev.whatsapp, interactiveButtons: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* EMAIL SPECIFIC CONFIGS */}
                  {selectedCatalogItem?.channel === Channel.EMAIL && (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Open Tracking Pixel
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Injects 1x1 transparent pixel to record email opens.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.email?.openTracking ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              email: { ...prev.email, openTracking: checked },
                            }))
                          }
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Click Tracking Links
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Rewrites outbound URLs for click-through telemetry.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.email?.clickTracking ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              email: { ...prev.email, clickTracking: checked },
                            }))
                          }
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Strict TLS (TLSv1.3 Required)
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Refuses delivery if recipient MTA does not negotiate TLS encryption.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.email?.tlsPolicy === 'REQUIRE'}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              email: { ...prev.email, tlsPolicy: checked ? 'REQUIRE' : 'OPPORTUNISTIC' },
                            }))
                          }
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Sandbox Mode
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Accepts and traces messages without live wire dispatch.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.email?.sandboxMode ?? false}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              email: { ...prev.email, sandboxMode: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* SMS SPECIFIC CONFIGS */}
                  {selectedCatalogItem?.channel === Channel.SMS && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                              Smart GSM-7 Packing (Anti Double-Billing)
                            </span>
                          </div>
                          <Switch
                            checked={featureConfigs.sms?.smartGsmPacking ?? true}
                            onCheckedChange={(checked) =>
                              setFeatureConfigs((prev) => ({
                                ...prev,
                                sms: { ...prev.sms, smartGsmPacking: checked },
                              }))
                            }
                          />
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          Automatically sanitizes smart quotes, em-dashes and invisible Unicode characters into standard
                          7-bit ASCII to prevent 160-char SMS splitting into 70-char UCS-2 segments (saves 50% carrier
                          fees).
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Alphanumeric Sender ID
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Replaces numbers with brand name in supported international regions.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.sms?.alphanumericSenderId ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              sms: { ...prev.sms, alphanumericSenderId: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* PUSH SPECIFIC CONFIGS */}
                  {selectedCatalogItem?.channel === Channel.PUSH && (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            FCM High-Priority Queue
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Bypasses Android device Doze battery saver.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.push?.fcmHighPriority ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              push: { ...prev.push, fcmHighPriority: checked },
                            }))
                          }
                        />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Auto Badge Increment
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Increments app icon unread badge count automatically.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.push?.badgeIncrement ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              push: { ...prev.push, badgeIncrement: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* SLACK / TOOL / OTHER CHANNELS */}
                  {(selectedCatalogItem?.channel === Channel.SLACK ||
                    selectedCatalogItem?.channel === Channel.TOOL ||
                    selectedCatalogItem?.channel === Channel.CHAT) && (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                            Unfurl Links & Media
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Expands URL previews and media attachments in channel stream.
                          </span>
                        </div>
                        <Switch
                          checked={featureConfigs.slack?.unfurlLinks ?? true}
                          onCheckedChange={(checked) =>
                            setFeatureConfigs((prev) => ({
                              ...prev,
                              slack: { ...prev.slack, unfurlLinks: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* SUB-TAB 3: Routing & Failover */}
                <TabsContent value="routing" className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Priority Tier */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Routing Priority Tier</span>
                        <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">Tier #{priority}</span>
                      </div>
                      <Slider value={priority} min={1} max={5} step={1} onValueChange={setPriority} />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        1 = Primary fast-path, 5 = Deep fallback
                      </p>
                    </div>

                    {/* Load Weight */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Traffic Load Share</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{weight}%</span>
                      </div>
                      <Slider value={weight} min={10} max={100} step={5} onValueChange={setWeight} />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Traffic distribution across same priority tier
                      </p>
                    </div>
                  </div>

                  {/* Failover Target Provider */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Automatic Failover Target
                    </label>
                    <Combobox
                      items={[
                        { value: '', label: 'None (Terminal on Failure)', sublabel: 'disabled' },
                        ...effectiveCatalog
                          .filter((c) => c.channel === selectedCatalogItem?.channel && c.id !== selectedCatalogItem?.id)
                          .map((c) => ({
                            value: c.id,
                            label: c.displayName,
                            sublabel: c.id,
                            badge: c.channel,
                          })),
                      ]}
                      value={fallbackProviderId}
                      onChange={setFallbackProviderId}
                      placeholder="Select failover provider..."
                      searchPlaceholder="Search failover provider..."
                      showCategoryTabs={false}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRegisterOpen(false)}
                className="rounded-xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={registerMutation.isPending}
                className="rounded-xl font-semibold shadow-2xs"
              >
                {t('providerConfig.saveConfig')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Full Environment Export */}
      <Dialog open={isEnvExportOpen} onOpenChange={setIsEnvExportOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('providerConfig.envVaultTitle')}</DialogTitle>
            <DialogDescription>{t('providerConfig.envVaultDesc')}</DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed shadow-inner">
              {envData?.envFileContent}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadEnv} className="gap-1.5 rounded-xl">
              <Download className="w-3.5 h-3.5" />
              <span>{t('providerConfig.downloadEnv')}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyEnv}
              className="gap-1.5 font-semibold rounded-xl shadow-2xs"
            >
              {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEnv ? t('common.copied') : t('providerConfig.copyEnv')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
