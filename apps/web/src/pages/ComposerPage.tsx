import { Channel } from '@convey/shared';
import { useMutation } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Code2, Play, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { OmnichannelPreview } from '../components/composer/OmnichannelPreview';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { api } from '../lib/api';

interface TestReceipt {
  publicId: string;
  status: string;
  channel: Channel;
  recipient: string;
  acceptedAt: string;
  simulatedLatencyMs: number;
  receiptUrl: string;
}

export function ComposerPage() {
  const [selectedChannel, setSelectedChannel] = useState<Channel>(Channel.EMAIL);
  const [recipient, setRecipient] = useState('developer@enterprise-corp.com');
  const [subject, setSubject] = useState('Your Security Verification Code is {{authCode}}');
  const [body, setBody] = useState(
    '<h1>Convey Security</h1><p>Hello <strong>{{customerName}}</strong>,</p><p>Your one-time authentication code is: <span style="color:#0284c7;font-size:20px;font-weight:bold;">{{authCode}}</span>.</p><p>This code expires in 10 minutes. If you did not request this, please contact support immediately.</p>',
  );
  const [variablesJson, setVariablesJson] = useState(
    JSON.stringify({ customerName: 'Alex Rivera', authCode: '749102', invoiceAmount: 1420.5 }, null, 2),
  );

  const [lastReceipt, setLastReceipt] = useState<TestReceipt | null>(null);

  // Parse variables safely
  let parsedVariables: Record<string, string | number | boolean> = {};
  let jsonError: string | null = null;
  try {
    if (variablesJson.trim()) {
      parsedVariables = JSON.parse(variablesJson);
    }
  } catch (err) {
    jsonError = err instanceof Error ? err.message : 'Invalid JSON';
  }

  // TanStack Mutation: Send test sandbox dispatch
  const sendMutation = useMutation({
    mutationFn: (data: { channel: Channel; recipient: string; payload: Record<string, unknown>; teamId?: string }) =>
      api.sendTestMessage(data),
    onSuccess: (res: TestReceipt) => {
      setLastReceipt(res);
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.8 },
      });
      toast.success(`Test message accepted with Public ID: ${res.publicId}`);
    },
    onError: () => {
      toast.error('Failed to dispatch test message');
    },
  });

  const handleChannelSwitch = (channel: Channel) => {
    setSelectedChannel(channel);
    if (channel === Channel.SMS) {
      setRecipient('+15550192831');
      setSubject('');
      setBody('Convey Alert: Your verification code is {{authCode}}. Valid for 10 minutes.');
    } else if (channel === Channel.WHATSAPP) {
      setRecipient('+15550192831');
      setSubject('');
      setBody('Hello {{customerName}}! Your order of ${{invoiceAmount}} has processed.');
    } else if (channel === Channel.SLACK) {
      setRecipient('#alerts-infrastructure');
      setSubject('Deployment Succeeded: Version 1.0.0');
      setBody('Cluster us-east-1 deployed successfully by {{customerName}}.');
    } else if (channel === Channel.PUSH) {
      setRecipient('device_token_fcm_019283');
      setSubject('New Activity Detected');
      setBody('{{customerName}} just logged into your workspace.');
    } else if (channel === Channel.EMAIL) {
      setRecipient('developer@enterprise-corp.com');
      setSubject('Your Security Verification Code is {{authCode}}');
      setBody(
        '<h1>Convey Security</h1><p>Hello <strong>{{customerName}}</strong>,</p><p>Your one-time authentication code is: <span style="color:#0284c7;font-size:20px;font-weight:bold;">{{authCode}}</span>.</p>',
      );
    }
  };

  const handleSendTest = () => {
    if (jsonError) {
      toast.error(`Invalid dynamic variables JSON: ${jsonError}`);
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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-400" />
            Omnichannel Composer & Live Sandbox
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Design multi-channel message templates, preview live device frames with variable interpolation, and trigger
            sandbox dispatches.
          </p>
        </div>

        <Button
          variant="glow"
          size="sm"
          isLoading={sendMutation.isPending}
          onClick={handleSendTest}
          className="text-xs gap-1.5 font-bold"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Send Test Dispatch</span>
        </Button>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="flex flex-wrap gap-2">
        {[Channel.EMAIL, Channel.SMS, Channel.WHATSAPP, Channel.SLACK, Channel.PUSH, Channel.TOOL].map((chan) => (
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
        ))}
      </div>

      {/* Workspace: Side-by-Side Editor & Frame Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template & Variables Editor (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="glass-panel">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Payload Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recipient Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Recipient Identifier</label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Email, E.164 phone, slack channel, or push token..."
                />
              </div>

              {/* Subject Input (if applicable) */}
              {(selectedChannel === Channel.EMAIL ||
                selectedChannel === Channel.SLACK ||
                selectedChannel === Channel.PUSH ||
                selectedChannel === Channel.TOOL) && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Subject / Title</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line with {{variables}} support..."
                  />
                </div>
              )}

              {/* Body / Content Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Message Content / Body ({selectedChannel === Channel.EMAIL ? 'HTML / Text' : 'Text'})
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[160px]"
                  placeholder="Enter message template..."
                />
              </div>

              {/* Dynamic Variables JSON Editor */}
              <div className="space-y-1 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Dynamic Variables (JSON)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Interpolated live</span>
                </div>
                <Textarea
                  value={variablesJson}
                  onChange={(e) => setVariablesJson(e.target.value)}
                  className={`min-h-[90px] ${jsonError ? 'border-rose-500/80 focus:border-rose-500' : ''}`}
                />
                {jsonError && (
                  <p className="text-[11px] font-mono text-rose-400 mt-1 flex items-center gap-1">
                    <span>⚠️ Invalid JSON: {jsonError}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Last Sandbox Dispatch Receipt */}
          {lastReceipt && (
            <Card className="glass-card border-sky-500/30">
              <CardHeader className="py-2.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sandbox Dispatch Receipt</span>
                </CardTitle>
                <Badge variant="success" dot>
                  {lastReceipt.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Public ID:</span>
                  <span className="text-white font-bold">{lastReceipt.publicId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Accepted Latency:</span>
                  <span className="text-emerald-400">{lastReceipt.simulatedLatencyMs}ms</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Interactive Omnichannel Frame Preview (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="glass-panel">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Live Frame Preview
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
