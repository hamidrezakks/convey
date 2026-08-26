import { Channel } from '@convey/shared';
import { useMutation } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  Briefcase,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileEdit,
  Layers,
  Play,
  Send,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
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
import { useEnvironment, useUiMode } from '../mode';

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
  const { isOps, isEngineer } = useUiMode();
  const { environment, isSandbox } = useEnvironment();
  const [selectedChannel, setSelectedChannel] = useState<Channel>(Channel.EMAIL);
  const [recipient, setRecipient] = useState(DEFAULT_TEMPLATES[Channel.EMAIL].recipient);
  const [subject, setSubject] = useState(DEFAULT_TEMPLATES[Channel.EMAIL].subject || '');
  const [body, setBody] = useState(DEFAULT_TEMPLATES[Channel.EMAIL].body);
  const [tabletViewTab, setTabletViewTab] = useState<'editor' | 'preview' | 'both'>('both');
  const [showJsonVariables, setShowJsonVariables] = useState(false);

  // API Modal states
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [snippetMode, setSnippetMode] = useState<'single' | 'batch' | 'fallback'>('single');
  const [snippetLang, setSnippetLang] = useState<'curl' | 'typescript' | 'python' | 'go'>('typescript');
  const [hasCopiedSnippet, setHasCopiedSnippet] = useState(false);

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

  // Code Generator for Composer Modal
  const getApiSnippet = (mode: 'single' | 'batch' | 'fallback', lang: 'curl' | 'typescript' | 'python' | 'go') => {
    const channelKey = selectedChannel.toUpperCase();
    const formattedVars = JSON.stringify(parsedVariables, null, 2);
    const fallbackChannel =
      selectedChannel === Channel.WHATSAPP ? 'SMS' : selectedChannel === Channel.PUSH ? 'EMAIL' : 'SMS';

    if (mode === 'single') {
      switch (lang) {
        case 'curl':
          return `curl -X POST https://api.convey.dev/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cnv_live_948f2198024982" \\
  -d '{
    "channel": "${channelKey}",
    "recipient": "${recipient}",
    "content": {
      ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n      ` : ''}"body": "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
      "variables": ${formattedVars.replace(/\n/g, '\n      ')}
    },
    "priority": "HIGH"
  }'`;

        case 'typescript':
          return `import { ConveyClient } from '@convey/sdk';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
});

// Single transactional message dispatch
const response = await convey.messages.send({
  channel: '${channelKey}',
  recipient: '${recipient}',
  content: {
    ${subject ? `subject: '${subject.replace(/'/g, "\\'")}',\n    ` : ''}body: \`${body.replace(/`/g, '\\`')}\`,
    variables: ${formattedVars.replace(/\n/g, '\n    ')},
  },
  priority: 'HIGH',
});

console.log('✅ Dispatched message ID:', response.messageId);`;

        case 'python':
          return `from convey import ConveyClient
import os

client = ConveyClient(api_key=os.environ["CONVEY_API_KEY"])

response = client.messages.send(
    channel="${channelKey}",
    recipient="${recipient}",
    content={
        ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n        ` : ''}"body": """${body}""",
        "variables": ${JSON.stringify(parsedVariables, null, 4).replace(/\n/g, '\n        ')}
    },
    priority="HIGH"
)

print(f"✅ Dispatched message ID: {response.message_id}")`;

        case 'go':
          return `package main

import (
	"context"
	"fmt"
	"os"

	"github.com/convey/convey-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"))

	res, err := client.Messages.Send(context.Background(), convey.SendMessageParams{
		Channel:   convey.Channel${channelKey === 'EMAIL' ? 'Email' : channelKey === 'WHATSAPP' ? 'WhatsApp' : channelKey === 'PUSH' ? 'Push' : 'SMS'},
		Recipient: "${recipient}",
		Content: convey.MessageContent{
			${subject ? `Subject: "${subject.replace(/"/g, '\\"')}",\n			` : ''}Body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
		},
		Priority: "HIGH",
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("✅ Message ID:", res.MessageID)
}`;
      }
    }

    if (mode === 'batch') {
      switch (lang) {
        case 'curl':
          return `curl -X POST https://api.convey.dev/v1/messages/bulk \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cnv_live_948f2198024982" \\
  -d '{
    "messages": [
      {
        "channel": "${channelKey}",
        "recipient": "${recipient}",
        "content": {
          ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n          ` : ''}"body": "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
          "variables": { "customerName": "Alex Rivera", "orgId": "org_88192" }
        }
      },
      {
        "channel": "${channelKey}",
        "recipient": "${selectedChannel === Channel.EMAIL ? 'sarah.connor@enterprise.corp' : '+1 (555) 019-9942'}",
        "content": {
          ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n          ` : ''}"body": "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
          "variables": { "customerName": "Sarah Connor", "orgId": "org_88193" }
        }
      }
    ]
  }'`;

        case 'typescript':
          return `import { ConveyClient } from '@convey/sdk';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
});

// High-throughput bulk broadcast dispatch
const batchResponse = await convey.messages.sendBulk([
  {
    channel: '${channelKey}',
    recipient: '${recipient}',
    content: {
      ${subject ? `subject: '${subject.replace(/'/g, "\\'")}',\n      ` : ''}body: \`${body.replace(/`/g, '\\`')}\`,
      variables: { customerName: 'Alex Rivera', orgId: 'org_88192' },
    },
  },
  {
    channel: '${channelKey}',
    recipient: '${selectedChannel === Channel.EMAIL ? 'sarah.connor@enterprise.corp' : '+1 (555) 019-9942'}',
    content: {
      ${subject ? `subject: '${subject.replace(/'/g, "\\'")}',\n      ` : ''}body: \`${body.replace(/`/g, '\\`')}\`,
      variables: { customerName: 'Sarah Connor', orgId: 'org_88193' },
    },
  },
]);

console.log(\`✅ Dispatched \${batchResponse.total} messages across worker pool\`);`;

        case 'python':
          return `from convey import ConveyClient
import os

client = ConveyClient(api_key=os.environ["CONVEY_API_KEY"])

batch = client.messages.send_bulk([
    {
        "channel": "${channelKey}",
        "recipient": "${recipient}",
        "content": {
            ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n            ` : ''}"body": """${body}""",
            "variables": {"customerName": "Alex Rivera", "orgId": "org_88192"}
        }
    },
    {
        "channel": "${channelKey}",
        "recipient": "${selectedChannel === Channel.EMAIL ? 'sarah.connor@enterprise.corp' : '+1 (555) 019-9942'}",
        "content": {
            ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n            ` : ''}"body": """${body}""",
            "variables": {"customerName": "Sarah Connor", "orgId": "org_88193"}
        }
    }
])

print(f"✅ Dispatched {batch.total} messages into transactional outbox")`;

        case 'go':
          return `package main

import (
	"context"
	"fmt"
	"os"

	"github.com/convey/convey-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"))

	batch, err := client.Messages.SendBulk(context.Background(), convey.BulkSendMessageParams{
		Messages: []convey.SendMessageParams{
			{
				Channel:   convey.Channel${channelKey === 'EMAIL' ? 'Email' : channelKey === 'WHATSAPP' ? 'WhatsApp' : channelKey === 'PUSH' ? 'Push' : 'SMS'},
				Recipient: "${recipient}",
				Content: convey.MessageContent{
					${subject ? `Subject: "${subject.replace(/"/g, '\\"')}",\n					` : ''}Body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
				},
			},
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Printf("✅ Accepted %d bulk messages\\n", batch.Total)
}`;
      }
    }

    // Fallback Mode
    switch (lang) {
      case 'curl':
        return `curl -X POST https://api.convey.dev/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cnv_live_948f2198024982" \\
  -d '{
    "cascade": true,
    "priority": "CRITICAL",
    "recipients": {
      "phone": "${recipient}",
      "email": "alex.rivera@enterprise.corp"
    },
    "channels": [
      {
        "channel": "${channelKey}",
        "content": {
          ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n          ` : ''}"body": "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
        }
      },
      {
        "channel": "${fallbackChannel}",
        "content": {
          "body": "Urgent update: ${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
        },
        "fallbackTrigger": {
          "condition": "UNREAD_OR_FAILED",
          "timeoutSeconds": 180
        }
      }
    ]
  }'`;

      case 'typescript':
        return `import { ConveyClient } from '@convey/sdk';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
});

// Omnichannel cascade with automated failover
const response = await convey.messages.send({
  cascade: true,
  priority: 'CRITICAL',
  recipients: {
    phone: '${recipient}',
    email: 'alex.rivera@enterprise.corp',
  },
  channels: [
    {
      channel: '${channelKey}',
      content: {
        ${subject ? `subject: '${subject.replace(/'/g, "\\'")}',\n        ` : ''}body: \`${body.replace(/`/g, '\\`')}\`,
      },
    },
    {
      channel: '${fallbackChannel}',
      content: {
        body: 'Urgent update: Check your notification inbox.',
      },
      fallbackTrigger: {
        condition: 'UNREAD_OR_FAILED',
        timeoutSeconds: 180, // 3 minutes timeout failover
      },
    },
  ],
});

console.log('✅ Omnichannel cascade initiated:', response.messageId);`;

      case 'python':
        return `from convey import ConveyClient
import os

client = ConveyClient(api_key=os.environ["CONVEY_API_KEY"])

response = client.messages.send(
    cascade=True,
    priority="CRITICAL",
    recipients={
        "phone": "${recipient}",
        "email": "alex.rivera@enterprise.corp"
    },
    channels=[
        {
            "channel": "${channelKey}",
            "content": {
                ${subject ? `"subject": "${subject.replace(/"/g, '\\"')}",\n                ` : ''}"body": """${body}"""
            }
        },
        {
            "channel": "${fallbackChannel}",
            "content": {"body": "Urgent update: Check notification."},
            "fallback_trigger": {"condition": "UNREAD_OR_FAILED", "timeout_seconds": 180}
        }
    ]
)

print(f"✅ Cascade initiated: {response.message_id}")`;

      case 'go':
        return `package main

import (
	"context"
	"fmt"
	"os"

	"github.com/convey/convey-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"))

	res, err := client.Messages.Send(context.Background(), convey.SendMessageParams{
		Cascade:  true,
		Priority: "CRITICAL",
		Recipients: map[string]string{
			"phone": "${recipient}",
			"email": "alex.rivera@enterprise.corp",
		},
		Channels: []convey.ChannelPayload{
			{
				Channel: convey.Channel${channelKey === 'EMAIL' ? 'Email' : channelKey === 'WHATSAPP' ? 'WhatsApp' : channelKey === 'PUSH' ? 'Push' : 'SMS'},
				Content: convey.MessageContent{Body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"},
			},
			{
				Channel: convey.Channel${fallbackChannel === 'EMAIL' ? 'Email' : 'SMS'},
				Content: convey.MessageContent{Body: "Urgent notification follow-up"},
				FallbackTrigger: &convey.FallbackConfig{
					Condition:      "UNREAD_OR_FAILED",
					TimeoutSeconds: 180,
				},
			},
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("✅ Cascade initialized:", res.MessageID)
}`;
    }
  };

  // TanStack Mutation: Send message with explicit environment tagging
  const sendMutation = useMutation({
    mutationFn: (data: {
      channel: Channel;
      recipient: string;
      payload: Record<string, unknown>;
      teamId?: string;
      isSandbox?: boolean;
    }) => api.sendTestMessage(data),
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
      toast.error('Failed to dispatch message');
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
      teamId: isSandbox ? 'team_sandbox' : 'team_production',
      isSandbox,
    });
  };

  const handleInsertVariable = (varName: string) => {
    setBody((prev) => `${prev} {{${varName}}}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Active Environment Banner */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
          isSandbox
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{isSandbox ? '🧪' : '🟢'}</span>
          <div>
            <span className="font-bold uppercase tracking-wider">
              {isSandbox ? 'Sandbox Safe Mode Active' : 'Production Live Dispatch Active'}
            </span>
            <p className="text-slate-600 dark:text-slate-400 font-normal">
              {isSandbox
                ? 'Messages are processed via Sandbox Adapter with zero provider costs and simulated webhook delivery.'
                : 'Messages will be dispatched to live provider networks (AWS SES, Twilio, SendGrid) with real financial ledger billing.'}
            </p>
          </div>
        </div>
        <Badge variant={isSandbox ? 'warning' : 'success'} className="font-mono text-[10px] uppercase shrink-0">
          {environment}
        </Badge>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
                {t('mode.opsComposerTitle')}
              </>
            ) : (
              <>
                <Send className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                {t('composer.title')}
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsComposerSubtitle') : t('composer.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Tab selector on mobile / tablet */}
          <div className="flex xl:hidden items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTabletViewTab('editor')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tabletViewTab === 'editor' ? 'bg-sky-500 text-slate-950 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setTabletViewTab('preview')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tabletViewTab === 'preview' ? 'bg-sky-500 text-slate-950 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setTabletViewTab('both')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tabletViewTab === 'both' ? 'bg-sky-500 text-slate-950 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <span className="hidden sm:inline">Split</span>
              <span className="sm:hidden">All</span>
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsApiModalOpen(true)}
            className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Use in API</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            isLoading={sendMutation.isPending}
            onClick={handleSendTest}
            className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs shrink-0 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isOps ? 'Send Test Message' : t('composer.sendTest')}</span>
          </Button>
        </div>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {[Channel.EMAIL, Channel.SMS, Channel.WHATSAPP, Channel.SLACK, Channel.CHAT, Channel.PUSH, Channel.TOOL].map(
          (chan) => (
            <Button
              key={chan}
              type="button"
              variant={selectedChannel === chan ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleChannelSwitch(chan)}
              className="text-xs font-medium rounded-xl"
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
                {isOps ? 'Message Content' : t('common.payload')}
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
                  placeholder={
                    isOps ? 'Enter customer email or phone...' : 'Email, E.164 phone, slack channel, or push token...'
                  }
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

              {/* Ops Mode Variable Insertion Chips */}
              {isOps && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Insert Customer Variable:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowJsonVariables(!showJsonVariables)}
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {showJsonVariables ? 'Hide JSON' : 'Advanced JSON'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['customerName', 'orgId', 'otpCode'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs font-mono transition-colors cursor-pointer"
                      >
                        + {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Variables JSON Editor (Engineer Mode or Opt-in) */}
              {(isEngineer || showJsonVariables) && (
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                      <span>{t('composer.variables')} (JSON)</span>
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
              )}
            </CardContent>
          </Card>

          {/* Last Sandbox Dispatch Receipt */}
          {lastReceipt && (
            <Card className="glass-card border-sky-500/30">
              <CardHeader className="py-2.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isOps ? 'Message Sent Successfully' : t('composer.testSandbox')}</span>
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

      {/* Modal: Use in API / SDK Integration Code Generator */}
      {isApiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Execute via API &amp; SDK</span>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase text-indigo-500">
                      {selectedChannel}
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Production-ready snippet with dynamic variables &amp; recipient payload.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApiModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dispatch Mode Selector Tabs (Single vs Batch vs Fallback) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setSnippetMode('single')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  snippetMode === 'single'
                    ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Single Dispatch</span>
              </button>

              <button
                type="button"
                onClick={() => setSnippetMode('batch')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  snippetMode === 'batch'
                    ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch Broadcast</span>
              </button>

              <button
                type="button"
                onClick={() => setSnippetMode('fallback')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  snippetMode === 'fallback'
                    ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Failover &amp; Fallback</span>
              </button>
            </div>

            {/* Language Selector Bar & Copy Action */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                {(['typescript', 'curl', 'python', 'go'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSnippetLang(lang)}
                    className={`px-3 py-1.5 rounded-md capitalize transition-all cursor-pointer ${
                      snippetLang === lang
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {lang === 'typescript'
                      ? 'Node / TypeScript'
                      : lang === 'curl'
                        ? 'cURL (REST)'
                        : lang === 'python'
                          ? 'Python'
                          : 'Go'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getApiSnippet(snippetMode, snippetLang));
                  setHasCopiedSnippet(true);
                  toast.success('Snippet copied to clipboard');
                  setTimeout(() => setHasCopiedSnippet(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                {hasCopiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Display Area */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0b0f19] text-slate-200 shadow-inner font-mono text-xs">
              <div className="bg-[#121826] px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {snippetLang === 'typescript'
                    ? 'index.ts'
                    : snippetLang === 'curl'
                      ? 'terminal.sh'
                      : snippetLang === 'python'
                        ? 'main.py'
                        : 'main.go'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {snippetMode === 'batch'
                    ? 'POST /v1/messages/bulk'
                    : snippetMode === 'fallback'
                      ? 'POST /v1/messages (Cascade)'
                      : 'POST /v1/messages'}
                </span>
              </div>
              <pre className="p-4 overflow-x-auto custom-scrollbar leading-relaxed text-indigo-200 max-h-[320px]">
                <code>{getApiSnippet(snippetMode, snippetLang)}</code>
              </pre>
            </div>

            {/* SDK Installation Helper */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Install SDK:</span>
                <code className="font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {snippetLang === 'typescript'
                    ? 'bun add @convey/sdk'
                    : snippetLang === 'python'
                      ? 'pip install convey-sdk'
                      : snippetLang === 'go'
                        ? 'go get github.com/convey/convey-go'
                        : 'curl --version'}
                </code>
              </div>
              <a
                href="https://docs.convey.dev"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Documentation</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
