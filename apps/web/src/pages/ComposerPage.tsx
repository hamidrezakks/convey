import { Channel } from '@convey/shared';
import { useMutation } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Code2, Eye, FileEdit, Play, Send, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { OmnichannelPreview } from '../components/composer/OmnichannelPreview';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useI18n } from '../i18n/context';
import type { TestMessageResult } from '../lib/api';
import { api } from '../lib/api';

const DEFAULT_TEMPLATES: Record<Channel, { subject?: string; body: string; recipient: string }> = {
  [Channel.EMAIL]: {
    subject: 'Welcome to Convey, {{customerName}}!',
    body: '<h1>Welcome, {{customerName}}!</h1><p>Your enterprise account is ready. Your organization ID is <strong>{{orgId}}</strong>.</p><p><a href="https://convey.io/get-started">Open Developer Dashboard</a></p>',
    recipient: 'alex.rivera@enterprise.corp',
  },
  [Channel.SMS]: {
    body: 'Convey Security OTP: {{otpCode}}. Valid for 10 minutes. Do not share this code.',
    recipient: '+1 (555) 019-2831',
  },
  [Channel.WHATSAPP]: {
    body: 'Hello {{customerName}}! Your reservation #{{orgId}} is confirmed for tonight at 8:00 PM.',
    recipient: '+44 7700 900077',
  },
  [Channel.SLACK]: {
    subject: 'Incident Alert: High Database Load on Node {{nodeId}}',
    body: 'Cluster node {{nodeId}} exceeded 92% memory saturation. Automated scaling group triggered.',
    recipient: '#alerts-infrastructure',
  },
  [Channel.PUSH]: {
    subject: 'Delivery Update',
    body: 'Driver is 5 minutes away with your parcel #{{orgId}}.',
    recipient: 'fcm_token_device_abc123',
  },
  [Channel.CHAT]: {
    subject: 'Support Ticket #{{orgId}}',
    body: 'Hi {{customerName}}, our support engineer has responded to your ticket.',
    recipient: 'chat_user_9918',
  },
  [Channel.TOOL]: {
    subject: 'Webhook Dispatch Event',
    body: '{"event": "payment.succeeded", "amount": 4900, "currency": "usd"}',
    recipient: 'https://api.partner.io/v1/webhooks',
  },
};

export function ComposerPage() {
  const { t } = useI18n();
  const [selectedChannel, setSelectedChannel] = useState<Channel>(Channel.EMAIL);
  const [recipient, setRecipient] = useState(DEFAULT_TEMPLATES[Channel.EMAIL].recipient);
  const [subject, setSubject] = useState(DEFAULT_TEMPLATES[Channel.EMAIL].subject || '');
  const [body, setBody] = useState(DEFAULT_TEMPLATES[Channel.EMAIL].body);
  const [tabletViewTab, setTabletViewTab] = useState<'editor' | 'preview' | 'both'>('both');

  const [variablesJson, setVariablesJson] = useState(
    JSON.stringify(
      {
        customerName: 'Alex Rivera',
        orgId: 'org_88192',
        otpCode: '849-201',
        nodeId: 'us-east-1a',
      },
      null,
      2,
    ),
  );

  const [lastReceipt, setLastReceipt] = useState<TestMessageResult | null>(null);

  // Parse variables JSON safely
  const { parsedVariables, jsonError } = useMemo(() => {
    try {
      const parsed = JSON.parse(variablesJson);
      return { parsedVariables: parsed, jsonError: null };
    } catch (err: unknown) {
      return { parsedVariables: {}, jsonError: err instanceof Error ? err.message : String(err) };
    }
  }, [variablesJson]);

  // TanStack Mutation: Send message in sandbox mode
  const sendMutation = useMutation({
    mutationFn: (data: { channel: Channel; recipient: string; payload: Record<string, unknown>; teamId?: string }) =>
      api.sendTestMessage(data),
    onSuccess: (receipt: TestMessageResult) => {
      setLastReceipt(receipt);
      confetti({
        particleCount: 50,
        spread: 45,
        origin: { y: 0.7 },
      });
      toast.success(`${t('composer.sendSuccess')}: ${receipt.publicId}`);
    },
    onError: () => {
      toast.error('Failed to dispatch test message in sandbox');
    },
  });

  const handleChannelSwitch = (newChannel: Channel) => {
    setSelectedChannel(newChannel);
    const tmpl = DEFAULT_TEMPLATES[newChannel];
    setRecipient(tmpl.recipient);
    setSubject(tmpl.subject || '');
    setBody(tmpl.body);
  };

  const handleSendTest = () => {
    if (!recipient.trim() || !body.trim()) {
      toast.error('Recipient and message body are required');
      return;
    }
    sendMutation.mutate({
      channel: selectedChannel,
      recipient,
      payload: {
        subject,
        body,
        variables: parsedVariables,
      },
      teamId: 'team_sandbox',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            {t('composer.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('composer.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Tab selector on mobile / tablet */}
          <div className="flex xl:hidden items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTabletViewTab('editor')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tabletViewTab === 'editor' ? 'bg-sky-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setTabletViewTab('preview')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tabletViewTab === 'preview' ? 'bg-sky-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setTabletViewTab('both')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tabletViewTab === 'both' ? 'bg-sky-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <span className="hidden sm:inline">Split</span>
              <span className="sm:hidden">All</span>
            </button>
          </div>

          <Button
            variant="glow"
            size="sm"
            isLoading={sendMutation.isPending}
            onClick={handleSendTest}
            className="text-xs gap-1.5 font-bold"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{t('composer.sendTest')}</span>
          </Button>
        </div>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="flex flex-wrap gap-2">
        {[Channel.EMAIL, Channel.SMS, Channel.WHATSAPP, Channel.SLACK, Channel.CHAT, Channel.PUSH, Channel.TOOL].map(
          (chan) => (
            <Button
              key={chan}
              type="button"
              variant={selectedChannel === chan ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleChannelSwitch(chan)}
              className="text-xs font-semibold"
            >
              {chan}
            </Button>
          ),
        )}
      </div>

      {/* Workspace: Adaptive Editor & Frame Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Template & Variables Editor */}
        <div className={`xl:col-span-6 space-y-4 ${tabletViewTab === 'preview' ? 'hidden xl:block' : 'block'}`}>
          <Card className="glass-panel">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('common.payload')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recipient Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('composer.recipient')}
                </label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Email, E.164 phone, slack channel, or push token..."
                />
              </div>

              {/* Subject Input (if applicable) */}
              {(selectedChannel === Channel.EMAIL ||
                selectedChannel === Channel.SLACK ||
                selectedChannel === Channel.CHAT ||
                selectedChannel === Channel.PUSH ||
                selectedChannel === Channel.TOOL) && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('composer.subject')}
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line with {{variables}} support..."
                  />
                </div>
              )}

              {/* Body / Content Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('composer.body')} ({selectedChannel === Channel.EMAIL ? 'HTML / Text' : 'Text'})
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[160px]"
                  placeholder="Enter message template..."
                />
              </div>

              {/* Dynamic Variables JSON Editor */}
              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                    <span>{t('composer.variables')}</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {t('overview.statusBadge')}
                  </span>
                </div>
                <Textarea
                  value={variablesJson}
                  onChange={(e) => setVariablesJson(e.target.value)}
                  className={`min-h-[90px] font-mono text-xs ${jsonError ? 'border-rose-500/80 focus:border-rose-500' : ''}`}
                />
                {jsonError && (
                  <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <span>
                      ⚠️ {t('composer.syntaxError')}: {jsonError}
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Last Sandbox Dispatch Receipt */}
          {lastReceipt && (
            <Card className="glass-card border-sky-500/30">
              <CardHeader className="py-2.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('composer.testSandbox')}</span>
                </CardTitle>
                <Badge variant="success" dot>
                  {lastReceipt.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{t('messages.colPublicId')}:</span>
                  <span className="text-slate-900 dark:text-white font-bold">{lastReceipt.publicId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{t('messages.colLatency')}:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{lastReceipt.simulatedLatencyMs}ms</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Interactive Omnichannel Frame Preview */}
        <div className={`xl:col-span-6 space-y-4 ${tabletViewTab === 'editor' ? 'hidden xl:block' : 'block'}`}>
          <Card className="glass-panel">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('composer.preview')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OmnichannelPreview
                channel={selectedChannel}
                recipient={recipient}
                subject={subject}
                body={body}
                variables={parsedVariables}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
