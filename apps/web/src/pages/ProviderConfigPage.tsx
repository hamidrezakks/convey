import {
  Channel,
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
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../lib/api';
import { providerKeys } from '../lib/queryKeys';

// Fallback catalog in case of network latency
const FALLBACK_CATALOG: ProviderCatalogItem[] = [
  {
    id: 'sendgrid',
    displayName: 'SendGrid Email API',
    channel: Channel.EMAIL,
    description: 'Twilio SendGrid high-volume transactional email API with dedicated IP warmup and DLR webhooks.',
    websiteUrl: 'https://sendgrid.com',
    docsUrl: 'https://docs.sendgrid.com/api-reference',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'SENDGRID_API_KEY',
        label: 'API Key',
        placeholder: 'SG.xxxxxxxx...',
        isSecret: true,
        description: 'SendGrid REST API Key with Mail Send permissions',
        required: true,
      },
      {
        key: 'SENDGRID_FROM_EMAIL',
        label: 'Default From Email',
        placeholder: 'notifications@yourdomain.com',
        isSecret: false,
        description: 'Verified sender domain email address',
        required: true,
      },
      {
        key: 'SENDGRID_WEBHOOK_SECRET',
        label: 'Webhook Verification Key',
        placeholder: 'MFkwEwYHKoZIzj0...',
        isSecret: true,
        description: 'Event Webhook ECDSA public verification key',
        required: false,
      },
    ],
  },
  {
    id: 'resend',
    displayName: 'Resend',
    channel: Channel.EMAIL,
    description: 'Modern developer-first transactional email API built for React Email and rapid delivery.',
    websiteUrl: 'https://resend.com',
    docsUrl: 'https://resend.com/docs',
    defaultPriority: 2,
    defaultWeight: 90,
    requiredEnvVars: [
      {
        key: 'RESEND_API_KEY',
        label: 'API Key',
        placeholder: 're_xxxxxxxx...',
        isSecret: true,
        description: 'Resend API Key with full access',
        required: true,
      },
      {
        key: 'RESEND_FROM_EMAIL',
        label: 'From Email Address',
        placeholder: 'onboarding@yourdomain.com',
        isSecret: false,
        description: 'Domain registered with Resend DNS',
        required: true,
      },
    ],
  },
  {
    id: 'aws-ses',
    displayName: 'Amazon Simple Email Service (SES)',
    channel: Channel.EMAIL,
    description: 'Cost-effective, highly scalable cloud email service powered by AWS global infrastructure.',
    websiteUrl: 'https://aws.amazon.com/ses/',
    docsUrl: 'https://docs.aws.amazon.com/ses/',
    defaultPriority: 3,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'AWS_SES_REGION',
        label: 'AWS Region',
        placeholder: 'us-east-1',
        isSecret: false,
        description: 'AWS SES Region (e.g. us-east-1, eu-west-1)',
        defaultValue: 'us-east-1',
        required: true,
      },
      {
        key: 'AWS_ACCESS_KEY_ID',
        label: 'AWS Access Key ID',
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
        isSecret: false,
        description: 'IAM User or Role credentials for ses:SendEmail',
        required: true,
      },
      {
        key: 'AWS_SECRET_ACCESS_KEY',
        label: 'AWS Secret Access Key',
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        isSecret: true,
        description: 'IAM Secret Key',
        required: true,
      },
      {
        key: 'AWS_SES_FROM_EMAIL',
        label: 'Verified Sender Email',
        placeholder: 'system@company.com',
        isSecret: false,
        description: 'Verified SES identity email or domain',
        required: true,
      },
    ],
  },
  {
    id: 'postmark',
    displayName: 'Postmark by ActiveCampaign',
    channel: Channel.EMAIL,
    description: 'Industry-leading transactional deliverability with dedicated inbound and outbound message tracking.',
    websiteUrl: 'https://postmarkapp.com',
    docsUrl: 'https://postmarkapp.com/developer',
    defaultPriority: 2,
    defaultWeight: 85,
    requiredEnvVars: [
      {
        key: 'POSTMARK_SERVER_TOKEN',
        label: 'Server API Token',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        isSecret: true,
        description: 'Postmark Server API Token',
        required: true,
      },
      {
        key: 'POSTMARK_FROM_EMAIL',
        label: 'Sender Signature Email',
        placeholder: 'alerts@yourdomain.com',
        isSecret: false,
        description: 'Verified sender signature address',
        required: true,
      },
    ],
  },
  {
    id: 'twilio',
    displayName: 'Twilio Programmable SMS',
    channel: Channel.SMS,
    description: 'Global carrier connectivity across 180+ countries with alphanumeric sender ID support.',
    websiteUrl: 'https://twilio.com',
    docsUrl: 'https://www.twilio.com/docs/sms',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'TWILIO_ACCOUNT_SID',
        label: 'Account SID',
        placeholder: 'ACxxxxxxxx...',
        isSecret: false,
        description: 'Twilio Main Account SID',
        required: true,
      },
      {
        key: 'TWILIO_AUTH_TOKEN',
        label: 'Auth Token',
        placeholder: 'auth_token_xxxx...',
        isSecret: true,
        description: 'Twilio Auth Token from Console',
        required: true,
      },
      {
        key: 'TWILIO_FROM_NUMBER',
        label: 'Sender Phone / Messaging Service SID',
        placeholder: '+18005550199 or MGxxxxxxxx',
        isSecret: false,
        description: 'Twilio phone number or Messaging Service SID',
        required: true,
      },
    ],
  },
  {
    id: 'telnyx',
    displayName: 'Telnyx Wireless & SMS',
    channel: Channel.SMS,
    description: 'Private global IP network and tier-1 carrier connection for ultra-low SMS latencies.',
    websiteUrl: 'https://telnyx.com',
    docsUrl: 'https://developers.telnyx.com/',
    defaultPriority: 2,
    defaultWeight: 90,
    requiredEnvVars: [
      {
        key: 'TELNYX_API_KEY',
        label: 'API Key',
        placeholder: 'KEYxxxxxxxx...',
        isSecret: true,
        description: 'Telnyx V2 API Profile Key',
        required: true,
      },
      {
        key: 'TELNYX_FROM_NUMBER',
        label: 'From Phone Number',
        placeholder: '+15550192831',
        isSecret: false,
        description: 'Purchased Telnyx E.164 number',
        required: true,
      },
    ],
  },
  {
    id: 'meta-whatsapp',
    displayName: 'Meta WhatsApp Cloud API',
    channel: Channel.WHATSAPP,
    description: 'Official Meta Graph API direct integration for template and 24h interactive session messages.',
    websiteUrl: 'https://developers.facebook.com/docs/whatsapp',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'WHATSAPP_PHONE_NUMBER_ID',
        label: 'Phone Number ID',
        placeholder: '109283746501928',
        isSecret: false,
        description: 'Meta WhatsApp Business Phone Number ID',
        required: true,
      },
      {
        key: 'WHATSAPP_ACCESS_TOKEN',
        label: 'System User Access Token',
        placeholder: 'EAAFxZxxxxxxxx...',
        isSecret: true,
        description: 'Permanent Meta System User Token with whatsapp_business_messaging',
        required: true,
      },
      {
        key: 'WHATSAPP_WABA_ID',
        label: 'WABA ID',
        placeholder: 'waba_9182736450',
        isSecret: false,
        description: 'WhatsApp Business Account ID',
        required: false,
      },
    ],
  },
  {
    id: 'fcm',
    displayName: 'Firebase Cloud Messaging (FCM v1)',
    channel: Channel.PUSH,
    description: 'Google FCM HTTP v1 API for iOS, Android, and Web Push notifications.',
    websiteUrl: 'https://firebase.google.com/docs/cloud-messaging',
    docsUrl: 'https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'FCM_PROJECT_ID',
        label: 'Firebase Project ID',
        placeholder: 'my-project-123',
        isSecret: false,
        description: 'Google Cloud / Firebase Project ID',
        required: true,
      },
      {
        key: 'FCM_SERVICE_ACCOUNT_KEY',
        label: 'Service Account JSON',
        placeholder: '{"type":"service_account",...}',
        isSecret: true,
        description: 'Google Cloud IAM Service Account JSON key string',
        required: true,
      },
    ],
  },
  {
    id: 'apns',
    displayName: 'Apple Push Notification service (APNs)',
    channel: Channel.PUSH,
    description: 'Direct Apple APNs HTTP/2 protocol sending with .p8 token authentication.',
    websiteUrl: 'https://developer.apple.com/documentation/usernotifications',
    docsUrl: 'https://developer.apple.com/documentation/usernotifications/sending_notification_requests_to_apns',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'APNS_KEY_ID',
        label: 'APNs Key ID (10 chars)',
        placeholder: 'ABC123DEFG',
        isSecret: false,
        description: 'Apple Developer Key Identifier',
        required: true,
      },
      {
        key: 'APNS_TEAM_ID',
        label: 'Apple Developer Team ID',
        placeholder: 'TEAMID1234',
        isSecret: false,
        description: 'Apple Developer 10-char Team ID',
        required: true,
      },
      {
        key: 'APNS_P8_PRIVATE_KEY',
        label: 'AuthKey .p8 Private Key',
        placeholder: '-----BEGIN PRIVATE KEY-----\\n...',
        isSecret: true,
        description: 'Contents of downloaded AuthKey_KEYID.p8',
        required: true,
      },
      {
        key: 'APNS_BUNDLE_ID',
        label: 'App Bundle Identifier',
        placeholder: 'com.company.app',
        isSecret: false,
        description: 'iOS App Bundle ID',
        required: true,
      },
    ],
  },
  {
    id: 'slack',
    displayName: 'Slack Enterprise Bot & Webhooks',
    channel: Channel.SLACK,
    description: 'Block Kit interactive messages, bot messaging, and channel webhooks.',
    websiteUrl: 'https://api.slack.com',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: 'Bot User OAuth Token',
        placeholder: 'xoxb-xxxxxxxx...',
        isSecret: true,
        description: 'Slack Bot OAuth Token (chat:write scope)',
        required: true,
      },
    ],
  },
  {
    id: 'custom-webhook',
    displayName: 'Generic Outbound HTTP Webhook',
    channel: Channel.TOOL,
    description: 'Arbitrary HTTP POST webhook dispatch with custom HMAC-SHA256 headers and mTLS.',
    defaultPriority: 1,
    defaultWeight: 100,
    requiredEnvVars: [
      {
        key: 'WEBHOOK_TARGET_URL',
        label: 'Target Endpoint URL',
        placeholder: 'https://api.external.com/v1/event',
        isSecret: false,
        description: 'Target destination URL',
        required: true,
      },
      {
        key: 'WEBHOOK_HMAC_SECRET',
        label: 'HMAC Signing Secret',
        placeholder: 'whsec_xxxxxxxx...',
        isSecret: true,
        description: 'Secret key used for X-Convey-Signature generation',
        required: false,
      },
    ],
  },
];

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

    // Populate initial credentials
    const initialCreds: Record<string, string> = {};
    if (targetItem?.requiredEnvVars) {
      for (const spec of targetItem.requiredEnvVars) {
        if (spec.defaultValue) {
          initialCreds[spec.key] = spec.defaultValue;
        }
      }
    }

    setCredentials(initialCreds);
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

  const filteredCatalog = effectiveCatalog.filter((item) => {
    const matchesChannel = catalogChannel === 'ALL' || item.channel === catalogChannel;
    const matchesSearch =
      item.displayName.toLowerCase().includes(searchCatalog.toLowerCase()) ||
      item.id.toLowerCase().includes(searchCatalog.toLowerCase()) ||
      item.description.toLowerCase().includes(searchCatalog.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  // Group catalog by channel for clean dropdown display
  const catalogByChannel = useMemo(() => {
    const map = new Map<Channel, ProviderCatalogItem[]>();
    for (const item of effectiveCatalog) {
      const list = map.get(item.channel) || [];
      list.push(item);
      map.set(item.channel, list);
    }
    return map;
  }, [effectiveCatalog]);

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
              PostgreSQL Persisted
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure API credentials, environment variables, WhatsApp 24h cost savings & carrier features stored
            directly in the `providers` table.
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
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Database Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">{configured.length} Persisted</div>
            <p className="text-[11px] text-slate-400 mt-1">Stored in Postgres `providers` Table</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">WhatsApp 24h Cost Saver</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-400 flex items-center gap-1.5">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>Active</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Saves ~$0.05/msg on Active Sessions</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Turnkey Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-indigo-400">{effectiveCatalog.length} Adapters</div>
            <p className="text-[11px] text-slate-400 mt-1">Multi-Channel Turnkey Ecosystem</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Environment Vault</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>AES-256-GCM</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">KMS Key Enveloped Secrets</p>
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
            <span>Turnkey Catalog ({effectiveCatalog.length} Available)</span>
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
                Postgres `providers` Table Ledger & Feature Configs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Active Feature Configs</TableHead>
                    <TableHead>Priority & Load</TableHead>
                    <TableHead>Failover Target</TableHead>
                    <TableHead>Credentials Mask</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isConfiguredLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                        Loading configurations from database...
                      </TableCell>
                    </TableRow>
                  ) : configured.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        No providers stored in database yet. Click "Register Provider" or choose from the Catalog!
                      </TableCell>
                    </TableRow>
                  ) : (
                    configured.map((p: ConfiguredProviderDto) => {
                      const cfg = p.config as ProviderFeatureConfigs | undefined;

                      return (
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

                          {/* Active Feature Config Badges */}
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.channel === Channel.WHATSAPP && cfg?.whatsapp?.costSaving24hSession && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-emerald-400" />
                                  24h Cost Saver
                                </span>
                              )}
                              {p.channel === Channel.EMAIL && cfg?.email?.openTracking && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono">
                                  Open Track
                                </span>
                              )}
                              {p.channel === Channel.EMAIL && cfg?.email?.clickTracking && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono">
                                  Click Track
                                </span>
                              )}
                              {p.channel === Channel.SMS && cfg?.sms?.smartGsmPacking && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono">
                                  Smart GSM-7
                                </span>
                              )}
                              {p.channel === Channel.PUSH && cfg?.push?.fcmHighPriority && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                                  High Priority
                                </span>
                              )}
                              {p.channel === Channel.SLACK && cfg?.slack?.unfurlLinks && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
                                  Unfurl Media
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="font-mono text-xs text-slate-300">
                            <span>Tier #{p.priority}</span> • <span className="text-emerald-400">{p.weight}%</span>
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
                              <Sliders className="w-3 h-3 text-sky-400" />
                              <span>Config</span>
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
            {isCatalogLoading && effectiveCatalog.length === 0 ? (
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
                              Active in DB
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
                          <span>{isConfigured ? 'Configure' : 'Register & Setup'}</span>
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
                  Unified environment variables for all active communication adapters stored in Postgres `providers`
                  table.
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

      {/* MODAL: Provider Registration & Multi-Tab Config Wizard */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleSubmitRegistration}>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-inner">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle>Configure & Register Provider</DialogTitle>
                  <DialogDescription>
                    Configure API credentials, environment variables, WhatsApp 24h cost saver & routing stored in
                    database.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Select Provider from Catalog */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Select Provider Adapter</label>
                <Select
                  value={selectedCatalogItem?.id || ''}
                  onChange={(e) => handleCatalogSelectChange(e.target.value)}
                >
                  {Array.from(catalogByChannel.entries()).map(([channel, items]) => (
                    <optgroup key={channel} label={`── ${channel} Providers ──`}>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName} ({item.id})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>

              {/* Sub-Tabs for Modal: Credentials, Features/Cost-Savings, Routing */}
              <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as 'creds' | 'features' | 'routing')}>
                <TabsList className="bg-slate-950 border border-slate-800 p-1 rounded-xl grid grid-cols-3">
                  <TabsTrigger value="creds" className="text-xs font-semibold gap-1.5">
                    <Key className="w-3 h-3 text-amber-400" />
                    <span>Credentials (.env)</span>
                  </TabsTrigger>
                  <TabsTrigger value="features" className="text-xs font-semibold gap-1.5">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>Feature Configs</span>
                  </TabsTrigger>
                  <TabsTrigger value="routing" className="text-xs font-semibold gap-1.5">
                    <Sliders className="w-3 h-3 text-sky-400" />
                    <span>Routing & Failover</span>
                  </TabsTrigger>
                </TabsList>

                {/* SUB-TAB 1: Credentials & Env Setup */}
                <TabsContent value="creds" className="space-y-3 pt-3">
                  {selectedCatalogItem && (
                    <div className="space-y-3 p-4 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">
                            {selectedCatalogItem.displayName} API Keys
                          </span>
                        </div>
                        <Badge variant="cyan">{selectedCatalogItem.channel}</Badge>
                      </div>

                      <p className="text-xs text-slate-400">{selectedCatalogItem.description}</p>

                      <div className="space-y-3 pt-1">
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
                            <p className="text-[11px] text-slate-500">{spec.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Connection Test Probe */}
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
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-300">
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
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Automatically converts pre-approved template messages to zero-cost plain text when user is
                          within the 24-hour service conversation window. Saves up to **$0.05 per message** on Meta
                          conversation charges.
                        </p>
                      </div>

                      {/* Auto Template Parameter Validation */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Auto-Template Validation</span>
                          <span className="text-[11px] text-slate-400">
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
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Interactive Reply Buttons</span>
                          <span className="text-[11px] text-slate-400">
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
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Open Tracking Pixel</span>
                          <span className="text-[11px] text-slate-400">
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

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Click Tracking Links</span>
                          <span className="text-[11px] text-slate-400">
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

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Strict TLS (TLSv1.3 Required)</span>
                          <span className="text-[11px] text-slate-400">
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

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Sandbox Mode</span>
                          <span className="text-[11px] text-slate-400">
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
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-bold text-indigo-300">
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
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Automatically sanitizes smart quotes, em-dashes and invisible Unicode characters into standard
                          7-bit ASCII to prevent 160-char SMS splitting into 70-char UCS-2 segments (saves 50% carrier
                          fees).
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Alphanumeric Sender ID</span>
                          <span className="text-[11px] text-slate-400">
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
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">FCM High-Priority Queue</span>
                          <span className="text-[11px] text-slate-400">
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

                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Auto Badge Increment</span>
                          <span className="text-[11px] text-slate-400">
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
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-white block">Unfurl Links & Media</span>
                          <span className="text-[11px] text-slate-400">
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
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Routing Priority Tier</span>
                        <span className="font-mono text-sky-400 font-bold">Tier #{priority}</span>
                      </div>
                      <Slider value={priority} min={1} max={5} step={1} onValueChange={setPriority} />
                      <p className="text-[10px] text-slate-400">1 = Primary fast-path, 5 = Deep fallback</p>
                    </div>

                    {/* Load Weight */}
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-300">Traffic Load Share</span>
                        <span className="font-mono text-emerald-400 font-bold">{weight}%</span>
                      </div>
                      <Slider value={weight} min={10} max={100} step={5} onValueChange={setWeight} />
                      <p className="text-[10px] text-slate-400">Traffic distribution across same priority tier</p>
                    </div>
                  </div>

                  {/* Failover Target Provider */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Automatic Failover Target</label>
                    <Select value={fallbackProviderId} onChange={(e) => setFallbackProviderId(e.target.value)}>
                      <option value="">None (Terminal on Failure)</option>
                      {effectiveCatalog
                        .filter((c) => c.channel === selectedCatalogItem?.channel && c.id !== selectedCatalogItem?.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName} ({c.id})
                          </option>
                        ))}
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" size="sm" isLoading={registerMutation.isPending}>
                Save & Persist to Database
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
