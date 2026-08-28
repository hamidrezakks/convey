import {
  Channel,
  type EmailAttachment,
  type EmailBrandTheme,
  type EmailChannelConfig,
  type PushActionButton,
  type PushChannelConfig,
  type PushInterruptionLevel,
  type RenderTemplateResponse,
  type TemplateDto,
  type WhatsAppButton,
  type WhatsAppButtonType,
  type WhatsAppChannelConfig,
  type WhatsAppHeaderType,
  type WhatsAppListRow,
} from '@convey/shared';
import {
  Archive,
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Forward,
  Globe,
  ImageIcon,
  Laptop,
  Layers,
  ListFilter,
  Loader2,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  Paperclip,
  Phone,
  Plus,
  Reply,
  Send,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * Transforms raw compiled HTML to simulate email client dark mode rendering.
 */
function getThemedEmailHtml(rawHtml: string | undefined, theme: 'light' | 'dark'): string {
  if (!rawHtml) {
    return `<div style="padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${
      theme === 'dark' ? '#94a3b8' : '#64748b'
    }; background: ${theme === 'dark' ? '#0b0f19' : '#f8fafc'}; min-height: 100vh;">Rendering email output...</div>`;
  }

  if (theme === 'light') {
    return rawHtml;
  }

  const darkModeCss = `
<style id="convey-email-dark-mode-override">
  :root {
    color-scheme: dark !important;
    supported-color-schemes: dark !important;
  }
  html, body {
    background-color: #0b0f19 !important;
    color: #e2e8f0 !important;
  }
  /* Invert outer background containers */
  body, .body, [style*="background-color: #f8fafc"], [style*="background-color:#f8fafc"], [style*="background-color: #f1f5f9"], [style*="background-color:#f1f5f9"], [style*="background-color: rgb(248, 250, 252)"] {
    background-color: #0b0f19 !important;
  }
  /* Convert white card surfaces to dark surface cards */
  [style*="background-color: #ffffff"], [style*="background-color:#ffffff"], [style*="background-color: #fff"], [style*="background-color:#fff"], [style*="background-color: white"], [style*="background-color: rgb(255, 255, 255)"], table[bgcolor="#ffffff"], td[bgcolor="#ffffff"] {
    background-color: #1a2234 !important;
  }
  /* Lighten dark text headings & paragraphs */
  [style*="color: #0f172a"], [style*="color:#0f172a"], [style*="color: #1e293b"], [style*="color:#1e293b"], [style*="color: #000000"], [style*="color:#000000"], [style*="color: #334155"], [style*="color:#334155"], [style*="color: #475569"], [style*="color:#475569"] {
    color: #f8fafc !important;
  }
  /* Subdued text */
  [style*="color: #64748b"], [style*="color:#64748b"], [style*="color: #94a3b8"] {
    color: #94a3b8 !important;
  }
  /* Borders and dividers */
  [style*="border-color: #e2e8f0"], [style*="border-color:#e2e8f0"], [style*="border-color: #f1f5f9"], hr {
    border-color: #334155 !important;
  }
</style>
`;

  if (rawHtml.includes('</head>')) {
    return rawHtml.replace('</head>', `${darkModeCss}</head>`);
  }
  if (rawHtml.includes('<body>')) {
    return rawHtml.replace('<body>', `<body>${darkModeCss}`);
  }
  return `${darkModeCss}${rawHtml}`;
}

export function TemplateStudioPage() {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(null);
  const [activeChannel, setActiveChannel] = useState<'email' | 'sms' | 'whatsapp' | 'push'>('email');
  const [activeLocale, setActiveLocale] = useState<string>('en-US');
  const [variablesJson, setVariablesJson] = useState<string>(
    JSON.stringify(
      {
        orderId: 'ORD-9942',
        customerName: 'Alex Mercer',
        itemsCount: 3,
        amount: 184.5,
        currency: 'USD',
        trackingUrl: 'https://convey.dev/track/ORD-9942',
        discountCode: 'SUMMER2026',
        discountPercent: '20%',
        deliveryDate: 'August 28, 2026',
        recipient: {
          name: 'Alex Mercer',
          email: 'alex@example.com',
          phone: '+14155552671',
        },
      },
      null,
      2,
    ),
  );

  const [renderedOutput, setRenderedOutput] = useState<RenderTemplateResponse | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // New Template Modal State
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');

  // Device & Theme Simulation States
  const [pushPreviewDevice, setPushPreviewDevice] = useState<'ios' | 'android'>('ios');
  const [emailPreviewDevice, setEmailPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [emailPreviewTheme, setEmailPreviewTheme] = useState<'light' | 'dark'>('light');
  const [isWhatsAppListOpen, setIsWhatsAppListOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [snippetMode, setSnippetMode] = useState<'single' | 'batch' | 'fallback'>('single');
  const [snippetLang, setSnippetLang] = useState<'curl' | 'typescript' | 'python' | 'go'>('typescript');
  const [hasCopiedSnippet, setHasCopiedSnippet] = useState(false);

  // Helper: Generates production code sample for using the active template in the API across Single, Batch, and Fallback modes
  const getApiSnippet = (mode: 'single' | 'batch' | 'fallback', lang: 'curl' | 'typescript' | 'python' | 'go') => {
    const slug = selectedTemplate?.slug || 'order_dispatch_alert';
    const channelKey = activeChannel.toUpperCase();
    let varsObj: Record<string, unknown> = {};
    try {
      varsObj = JSON.parse(variablesJson);
    } catch {
      varsObj = { orderId: 'ORD-9942', itemsCount: 3 };
    }
    const formattedVars = JSON.stringify(varsObj, null, 2);
    const targetRecipient =
      activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155552671' : 'alex@example.com';
    const fallbackChannel = activeChannel === 'whatsapp' ? 'SMS' : activeChannel === 'push' ? 'EMAIL' : 'SMS';

    if (mode === 'single') {
      switch (lang) {
        case 'curl':
          return `curl -X POST https://api.convey.dev/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cnv_live_948f2198024982" \\
  -d '{
    "channel": "${channelKey}",
    "recipient": "${targetRecipient}",
    "templateId": "${slug}",
    "variables": ${formattedVars.replace(/\n/g, '\n    ')},
    "priority": "HIGH"
  }'`;

        case 'typescript':
          return `import { ConveyClient } from '@convey/sdk';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
});

// Single transactional dispatch with template "${slug}"
const response = await convey.messages.send({
  channel: '${channelKey}',
  recipient: '${targetRecipient}',
  templateId: '${slug}',
  variables: ${formattedVars.replace(/\n/g, '\n  ')},
  priority: 'HIGH',
});

console.log('✅ Message accepted:', response.messageId);`;

        case 'python':
          return `import os
from convey import Convey, Channel, MessagePriority

client = Convey(api_key=os.environ["CONVEY_API_KEY"])

# Single transactional dispatch with template "${slug}"
response = client.messages.send(
    channel=Channel.${channelKey},
    recipient="${targetRecipient}",
    content={
        "template_id": "${slug}",
        "variables": ${JSON.stringify(varsObj, null, 4).replace(/\n/g, '\n        ')}
    },
    priority=MessagePriority.HIGH
)

print(f"✅ Message accepted: {response.public_id} ({response.status})")`;

        case 'go':
          return `package main

import (
	"context"
	"fmt"
	"os"

	"github.com/hamidrezakks/convey/packages/sdk-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"))

	res, err := client.Messages.Send(context.Background(), convey.SendMessageRequest{
		Channel:   convey.Channel${channelKey === 'EMAIL' ? 'Email' : channelKey === 'WHATSAPP' ? 'WhatsApp' : channelKey === 'PUSH' ? 'Push' : 'SMS'},
		Recipient: "${targetRecipient}",
		Content: &convey.MessageContent{
			TemplateID: "${slug}",
			Variables: map[string]interface{}{
				"orderId": "ORD-9942",
			},
		},
		Priority: convey.PriorityHigh,
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("✅ Message accepted:", res.PublicID)
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
        "recipient": "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550101' : 'alex@example.com'}",
        "templateId": "${slug}",
        "variables": { "orderId": "ORD-9941", "customerName": "Alex Mercer" }
      },
      {
        "channel": "${channelKey}",
        "recipient": "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550102' : 'sarah@example.com'}",
        "templateId": "${slug}",
        "variables": { "orderId": "ORD-9942", "customerName": "Sarah Connor" }
      },
      {
        "channel": "${channelKey}",
        "recipient": "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550103' : 'elena@example.com'}",
        "templateId": "${slug}",
        "variables": { "orderId": "ORD-9943", "customerName": "Elena Rostova" }
      }
    ]
  }'`;

        case 'typescript':
          return `import { ConveyClient } from '@convey/sdk';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
});

// High-throughput bulk broadcast with per-recipient template variables
const batchResponse = await convey.messages.sendBulk([
  {
    channel: '${channelKey}',
    recipient: '${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550101' : 'alex@example.com'}',
    templateId: '${slug}',
    variables: { orderId: 'ORD-9941', customerName: 'Alex Mercer' },
  },
  {
    channel: '${channelKey}',
    recipient: '${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550102' : 'sarah@example.com'}',
    templateId: '${slug}',
    variables: { orderId: 'ORD-9942', customerName: 'Sarah Connor' },
  },
  {
    channel: '${channelKey}',
    recipient: '${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550103' : 'elena@example.com'}',
    templateId: '${slug}',
    variables: { orderId: 'ORD-9943', customerName: 'Elena Rostova' },
  },
]);

console.log(\`✅ Accepted \${batchResponse.total} messages across virtual shards\`);`;

        case 'python':
          return `import os
from convey import Convey, Channel

client = Convey(api_key=os.environ["CONVEY_API_KEY"])

# High-throughput batch broadcast into transactional outbox
batch = client.messages.send_bulk([
    {
        "channel": "${channelKey}",
        "recipient": "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550101' : 'alex@example.com'}",
        "content": {
            "template_id": "${slug}",
            "variables": {"orderId": "ORD-9941", "customerName": "Alex Mercer"}
        }
    },
    {
        "channel": "${channelKey}",
        "recipient": "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550102' : 'sarah@example.com'}",
        "content": {
            "template_id": "${slug}",
            "variables": {"orderId": "ORD-9942", "customerName": "Sarah Connor"}
        }
    }
])

print(f"✅ Dispatched {batch.total} messages into worker pool")`;

        case 'go':
          return `package main

import (
	"context"
	"fmt"
	"os"

	"github.com/hamidrezakks/convey/packages/sdk-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"))

	batch, err := client.Messages.SendBulk(context.Background(), []convey.SendMessageRequest{
		{
			Channel:   convey.Channel${channelKey === 'EMAIL' ? 'Email' : channelKey === 'WHATSAPP' ? 'WhatsApp' : channelKey === 'PUSH' ? 'Push' : 'SMS'},
			Recipient: "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550101' : 'alex@example.com'}",
			Content: &convey.MessageContent{
				TemplateID: "${slug}",
				Variables:  map[string]interface{}{"orderId": "ORD-9941", "customerName": "Alex"},
			},
		},
		{
			Channel:   convey.Channel${channelKey === 'EMAIL' ? 'Email' : channelKey === 'WHATSAPP' ? 'WhatsApp' : channelKey === 'PUSH' ? 'Push' : 'SMS'},
			Recipient: "${activeChannel === 'sms' || activeChannel === 'whatsapp' ? '+14155550102' : 'sarah@example.com'}",
			Content: &convey.MessageContent{
				TemplateID: "${slug}",
				Variables:  map[string]interface{}{"orderId": "ORD-9942", "customerName": "Sarah"},
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

    // Fallback & Cascade Mode
    switch (lang) {
      case 'curl':
        return `curl -X POST https://api.convey.dev/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cnv_live_948f2198024982" \\
  -d '{
    "cascade": true,
    "priority": "CRITICAL",
    "recipients": {
      "whatsapp": "+14155552671",
      "phone": "+14155552671",
      "email": "alex@example.com"
    },
    "channels": [
      {
        "channel": "${channelKey}",
        "templateId": "${slug}",
        "variables": ${formattedVars.replace(/\n/g, '\n        ')}
      },
      {
        "channel": "${fallbackChannel}",
        "templateId": "${slug}",
        "variables": ${formattedVars.replace(/\n/g, '\n        ')},
        "fallbackTrigger": {
          "condition": "UNREAD_OR_FAILED",
          "timeoutSeconds": 180
        }
      }
    ]
  }'`;

      case 'typescript':
        return `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
});

// Omnichannel cascade with automatic multi-channel fallback
const response = await convey.messages.send({
  cascade: true,
  priority: 'CRITICAL',
  recipients: {
    whatsapp: '+14155552671',
    phone: '+14155552671',
    email: 'alex@example.com',
  },
  channels: [
    {
      channel: '${channelKey}',
      templateId: '${slug}',
      variables: ${formattedVars.replace(/\n/g, '\n      ')},
    },
    {
      channel: '${fallbackChannel}',
      templateId: '${slug}',
      variables: ${formattedVars.replace(/\n/g, '\n      ')},
      fallbackTrigger: {
        condition: 'UNREAD_OR_FAILED',
        timeoutSeconds: 180, // 3 minutes failover window
      },
    },
  ],
});

console.log('✅ Omnichannel cascade initiated:', response.publicId);`;

      case 'python':
        return `import os
from convey import Convey, MessagePriority

client = Convey(api_key=os.environ["CONVEY_API_KEY"])

# Omnichannel cascade with automatic multi-channel fallback
response = client.messages.send({
    "cascade": True,
    "priority": MessagePriority.CRITICAL,
    "recipients": {
        "whatsapp": "+14155552671",
        "phone": "+14155552671",
        "email": "alex@example.com"
    },
    "channels": [
        {
            "channel": "${channelKey}",
            "template_id": "${slug}",
            "variables": ${JSON.stringify(varsObj, null, 4).replace(/\n/g, '\n            ')}
        },
        {
            "channel": "${fallbackChannel}",
            "template_id": "${slug}",
            "variables": ${JSON.stringify(varsObj, null, 4).replace(/\n/g, '\n            ')},
            "fallback_trigger": {
                "condition": "UNREAD_OR_FAILED",
                "timeout_seconds": 180
            }
        }
    ]
})

print(f"✅ Omnichannel cascade initiated: {response.public_id}")`;

      case 'go':
        return `package main

import (
	"context"
	"fmt"
	"os"

	"github.com/hamidrezakks/convey/packages/sdk-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"))

	res, err := client.Messages.Send(context.Background(), convey.SendMessageRequest{
		Cascade:  true,
		Priority: convey.PriorityCritical,
		Recipients: map[string]interface{}{
			"whatsapp": "+14155552671",
			"phone":    "+14155552671",
			"email":    "alex@example.com",
		},
		Channels: []map[string]interface{}{
			{
				"channel":    "${channelKey}",
				"templateId": "${slug}",
				"variables":  map[string]interface{}{"orderId": "ORD-9942"},
			},
			{
				"channel":    "${fallbackChannel}",
				"templateId": "${slug}",
				"variables":  map[string]interface{}{"orderId": "ORD-9942"},
			},
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Println("✅ Cascade initialized:", res.PublicID)
}`;
    }
  };

  // 1. EMAIL CHANNEL STATES (Advanced Enterprise Configuration)
  const [emailSubject, setEmailSubject] = useState('Order #{{orderId}} Confirmation & Tracking');
  const [emailPreviewText, setEmailPreviewText] = useState(
    'Your {{itemsCount}} items are packed and ready for delivery today.',
  );
  const [emailFromName, setEmailFromName] = useState('Convey Logistics');
  const [emailFromAddress, setEmailFromAddress] = useState('orders@convey.dev');
  const [emailReplyTo, setEmailReplyTo] = useState('support@convey.dev');
  const [emailBrandTheme, setEmailBrandTheme] = useState<EmailBrandTheme>({
    primaryColor: '#3b82f6',
    backgroundColor: '#f8fafc',
    cardBackgroundColor: '#ffffff',
    fontFamily: 'Inter, -apple-system, sans-serif',
    logoUrl: 'https://cdn.convey.dev/assets/brand-logo.png',
    logoHeightPx: 36,
  });
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([
    {
      contentId: 'att_default_1',
      filename: 'Invoice_ORD-{{orderId}}.pdf',
      contentType: 'application/pdf',
      sizeBytes: 134200,
      disposition: 'attachment',
    },
  ]);
  const [emailMjml, setEmailMjml] = useState(
    `<mjml>
  <mj-head>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, sans-serif" />
      <mj-text font-size="14px" color="#334155" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f8fafc">
    <mj-section background-color="#ffffff" border-radius="12px" padding="32px 24px">
      <mj-column width="100%">
        <mj-text font-size="22px" font-weight="700" color="#0f172a" padding-bottom="8px">
          Your order #{{orderId}} is confirmed! 📦
        </mj-text>
        <mj-text font-size="15px" color="#475569">
          Hi {{recipient.name}}, thanks for your purchase. We are preparing your {{itemsCount}} items for shipment.
        </mj-text>
        
        <mj-divider border-color="#e2e8f0" border-width="1px" padding="16px 0" />
        
        <mj-table cellpadding="6px">
          <tr style="border-bottom: 1px solid #f1f5f9; text-align: left; color: #64748b; font-size: 12px;">
            <th>Summary</th>
            <th style="text-align: right;">Value</th>
          </tr>
          <tr style="font-size: 14px; font-weight: 600; color: #0f172a;">
            <td>Order Total</td>
            <td style="text-align: right;">{{amount | currency: 'USD'}}</td>
          </tr>
          <tr style="font-size: 13px; color: #64748b;">
            <td>Delivery PIN</td>
            <td style="text-align: right; font-family: monospace;">{{deliveryPin}}</td>
          </tr>
        </mj-table>
        
        <mj-button href="{{trackingUrl}}" background-color="#3b82f6" border-radius="8px" font-weight="600" font-size="14px" padding-top="20px">
          Track Live Delivery 🚚
        </mj-button>
        
        <mj-text font-size="12px" color="#94a3b8" align="center" padding-top="24px">
          Need assistance? Reply directly to this email or contact support@convey.dev.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  );

  // 2. SMS CHANNEL STATES
  const [smsBody, setSmsBody] = useState(
    'Order #{{orderId}} confirmed! Total: ${{amount}}. Track delivery: {{trackingUrl}}',
  );

  // 3. WHATSAPP CHANNEL STATES
  const [waHeaderType, setWaHeaderType] = useState<WhatsAppHeaderType>('image');
  const [waHeaderText, setWaHeaderText] = useState('📦 Order #{{orderId}} Dispatched!');
  const [waHeaderMediaUrl, setWaHeaderMediaUrl] = useState(
    'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80',
  );
  const [waBody, setWaBody] = useState(
    'Hello *{{recipient.name}}*,\n\nYour package containing *{{itemsCount}} items* has been handed over to our courier partner. Estimated delivery is *Today by 6:00 PM*.\n\nPlease choose an action below or reply to this message.',
  );
  const [waFooter, setWaFooter] = useState('Convey Logistics • Reply STOP to unsubscribe');
  const [waButtons, setWaButtons] = useState<WhatsAppButton[]>([
    {
      type: 'url',
      text: 'Track Live Delivery 🚚',
      url: 'https://track.convey.dev/{{orderId}}',
    },
    {
      type: 'quick_reply',
      text: 'Reschedule Date 📅',
      id: 'btn_reschedule',
    },
    {
      type: 'copy_code',
      text: 'Copy Delivery PIN 🔑',
      code: '{{deliveryPin}}',
    },
  ]);
  const [waListButtonText, setWaListButtonText] = useState('Delivery Instructions 📋');

  // 4. PUSH CHANNEL STATES
  const [pushTitle, setPushTitle] = useState('Out for Delivery: Order #{{orderId}}');
  const [pushSubtitle, setPushSubtitle] = useState('Courier arriving in ~25 mins');
  const [pushBody, setPushBody] = useState('Courier {{courierName}} is 2 stops away with your {{itemsCount}} items.');
  const [pushImageUrl, setPushImageUrl] = useState(
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
  );
  const [pushInterruption, setPushInterruption] = useState<PushInterruptionLevel>('time-sensitive');
  const [pushSound, setPushSound] = useState('chime.caf');
  const [pushActionButtons, setPushActionButtons] = useState<PushActionButton[]>([
    { id: 'btn_approve', title: 'Leave at Door 🚪', icon: 'check', isDestructive: false },
    { id: 'btn_call', title: 'Call Driver 📞', icon: 'phone', isDestructive: false },
  ]);
  const [pushClickUrl, setPushClickUrl] = useState('convey://orders/{{orderId}}');

  // Fetch templates on load
  const loadTemplates = async () => {
    try {
      const res = await api.listTemplates();
      if (res.success && res.templates) {
        setTemplates(res.templates);
        if (res.templates.length > 0 && !selectedTemplate) {
          handleSelectTemplate(res.templates[0]);
        }
      }
    } catch {
      // Fallback mock templates if backend not yet seeded
      const fallback: TemplateDto[] = [
        {
          id: 'tpl_1',
          publicId: 'tpl_019ff136-1',
          tenantId: '019ff136-0000',
          team: 'core',
          environment: 'production',
          slug: 'order_dispatch_alert',
          name: 'Order Dispatch Multi-Channel',
          category: 'transactional',
          defaultLocale: 'en-US',
          publishedVersionId: 'v1',
          publishedVersion: {
            id: 'v1',
            templateId: 'tpl_1',
            version: '1.0.0',
            status: 'published',
            schema: {},
            channels: {
              email: {
                subject: 'Order #{{orderId}} Confirmation',
                previewText: 'Your order is confirmed and shipping soon.',
                mjml: emailMjml,
              },
              sms: { body: 'Your order is confirmed.' },
              whatsapp: {
                body: 'Hello Alex, your order is out for delivery!',
                footer: 'Convey Logistics',
              },
              push: {
                title: 'Out for Delivery: Order #ORD-9942',
                body: 'Courier arriving in ~25 mins',
              },
            },
            translations: {},
            author: 'system',
            createdAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setTemplates(fallback);
      setSelectedTemplate(fallback[0]);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSelectTemplate = async (tpl: TemplateDto) => {
    setSelectedTemplate(tpl);
    try {
      const details = await api.getTemplate(tpl.slug);
      if (details.success && details.template) {
        const v = details.template.publishedVersion;
        if (v?.channels.email) {
          setEmailSubject(v.channels.email.subject || '');
          if (v.channels.email.previewText) setEmailPreviewText(v.channels.email.previewText);
          if (v.channels.email.fromName) setEmailFromName(v.channels.email.fromName);
          if (v.channels.email.fromEmail) setEmailFromAddress(v.channels.email.fromEmail);
          if (v.channels.email.replyTo) setEmailReplyTo(v.channels.email.replyTo);
          if (v.channels.email.mjml) setEmailMjml(v.channels.email.mjml);
        }
        if (v?.channels.sms) {
          setSmsBody(v.channels.sms.body || '');
        }
        if (v?.channels.whatsapp?.body) {
          setWaBody(v.channels.whatsapp.body);
        }
        if (v?.channels.push?.title) {
          setPushTitle(v.channels.push.title);
          setPushBody(v.channels.push.body);
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleTestRender = async () => {
    setIsRendering(true);
    try {
      let parsedVars: Record<string, unknown> = {};
      try {
        parsedVars = JSON.parse(variablesJson);
      } catch {
        toast.error('Invalid JSON variables context');
        setIsRendering(false);
        return;
      }

      const emailSpec: EmailChannelConfig = {
        subject: emailSubject,
        previewText: emailPreviewText,
        fromName: emailFromName,
        fromEmail: emailFromAddress,
        replyTo: emailReplyTo,
        brandTheme: emailBrandTheme,
        attachments: emailAttachments,
        mjml: emailMjml,
      };

      const waSpec: WhatsAppChannelConfig = {
        header:
          waHeaderType !== 'text'
            ? { type: waHeaderType, mediaUrl: waHeaderMediaUrl }
            : { type: 'text', text: waHeaderText },
        body: waBody,
        footer: waFooter,
        buttons: waButtons,
        interactiveList: {
          buttonText: waListButtonText,
          sections: [
            {
              title: 'Delivery Options',
              rows: [
                { id: 'opt_1', title: 'Leave at front door 🚪', description: 'Safe location on porch' },
                { id: 'opt_2', title: 'Leave with neighbor 🤝', description: 'Unit 4B next door' },
                { id: 'opt_3', title: 'Require signature ✍️', description: 'Hand delivery only' },
              ],
            },
          ],
        },
      };

      const pushSpec: PushChannelConfig = {
        title: pushTitle,
        subtitle: pushSubtitle,
        body: pushBody,
        imageUrl: pushImageUrl,
        sound: pushSound,
        interruptionLevel: pushInterruption,
        actionButtons: pushActionButtons,
        clickActionUrl: pushClickUrl,
      };

      let channelPayload: Channel = Channel.EMAIL;
      if (activeChannel === 'sms') channelPayload = Channel.SMS;
      if (activeChannel === 'push') channelPayload = Channel.PUSH;
      if (activeChannel === 'whatsapp') channelPayload = Channel.WHATSAPP;

      const res = await api.renderTemplate({
        channel: channelPayload,
        templateSpec: {
          email: emailSpec,
          sms: { body: smsBody },
          whatsapp: waSpec,
          push: pushSpec,
        },
        variables: parsedVars,
        locale: activeLocale,
      });

      if (res.success && res.rendered) {
        setRenderedOutput(res.rendered);
        toast.success(`Compiled ${activeChannel.toUpperCase()} (${res.rendered.localeUsed})`);
      }
    } catch (err: unknown) {
      toast.error(`Render error: ${(err as Error).message}`);
    } finally {
      setIsRendering(false);
    }
  };

  // Compile on mount or tab change
  useEffect(() => {
    handleTestRender();
  }, [activeChannel, activeLocale]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlug || !newName) return;
    try {
      const res = await api.createTemplate({
        slug: newSlug.toLowerCase().trim().replace(/\s+/g, '_'),
        name: newName.trim(),
        category: 'transactional',
        defaultLocale: 'en-US',
        initialVersion: {
          version: '1.0.0',
          channels: {
            email: {
              subject: emailSubject,
              previewText: emailPreviewText,
              fromName: emailFromName,
              fromEmail: emailFromAddress,
              replyTo: emailReplyTo,
              mjml: emailMjml,
            },
            sms: { body: smsBody },
            whatsapp: { body: waBody },
            push: { title: pushTitle, body: pushBody },
          },
        },
      });
      if (res.success && res.template) {
        toast.success(`Created template "${res.template.name}"`);
        setTemplates([res.template, ...templates]);
        setSelectedTemplate(res.template);
        setIsCreatingNew(false);
        setNewSlug('');
        setNewName('');
      }
    } catch (err: unknown) {
      toast.error(`Failed to create template: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Multi-Channel Template Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 whitespace-nowrap">
              Enterprise AST &amp; MJML v2.5
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enterprise content registry with draft/publish versioning, rich Email with attachments &amp; preheaders,
            WhatsApp components, and APNs/FCM interactive push notifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsApiModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg shadow-xs transition-all shrink-0 whitespace-nowrap cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <Code2 className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Use in API</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-semibold rounded-lg shadow-sm transition-all shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Template</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Catalog Navigation */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Templates ({templates.length})
            </h2>
          </div>

          <div className="space-y-1.5 custom-scrollbar max-h-[600px] overflow-y-auto">
            {templates.map((tpl) => (
              <button
                key={tpl.slug}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedTemplate?.slug === tpl.slug
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
                    : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{tpl.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    {tpl.publishedVersion?.version || 'v1.0.0'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{tpl.slug}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Middle Column: Multi-Channel Editor */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {selectedTemplate?.name || 'Template Editor'}
              </h2>
              <span className="text-xs text-slate-400 font-mono">{selectedTemplate?.slug}</span>
            </div>

            {/* Channel Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg gap-1">
              {(['email', 'whatsapp', 'push', 'sms'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setActiveChannel(ch)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md uppercase transition-all ${
                    activeChannel === ch
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* 1. EMAIL BUILDER (Expanded Capabilities) */}
          {activeChannel === 'email' && (
            <div className="space-y-4">
              {/* Subject & Preheader */}
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Preview / Preheader Snippet</span>
                    <span className="text-[10px] text-slate-400 font-normal">Hidden in email body</span>
                  </label>
                  <input
                    type="text"
                    value={emailPreviewText}
                    onChange={(e) => setEmailPreviewText(e.target.value)}
                    placeholder="Short summary displayed in inbox previews..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sender & Reply-To Headers */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    From Sender Name
                  </label>
                  <input
                    type="text"
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    From Email Address
                  </label>
                  <input
                    type="text"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono"
                  />
                </div>
              </div>

              {/* MJML Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                    Responsive MJML 4 Source
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Auto-inlines CSS &amp; wraps HTML</span>
                </div>
                <textarea
                  rows={8}
                  value={emailMjml}
                  onChange={(e) => setEmailMjml(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar leading-relaxed"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                    Dynamic Attachments ({emailAttachments.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEmailAttachments([
                        ...emailAttachments,
                        {
                          contentId: `att_${Date.now()}`,
                          filename: `Attachment_${Date.now()}.pdf`,
                          contentType: 'application/pdf',
                          sizeBytes: 84000,
                          disposition: 'attachment',
                        },
                      ])
                    }
                    className="text-[11px] text-indigo-600 hover:text-indigo-500 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Attachment
                  </button>
                </div>

                <div className="space-y-1.5">
                  {emailAttachments.map((att, idx) => (
                    <div
                      key={att.contentId || att.filename}
                      className="p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={att.filename}
                          onChange={(e) => {
                            const updated = [...emailAttachments];
                            updated[idx].filename = e.target.value;
                            setEmailAttachments(updated);
                          }}
                          className="bg-transparent border-none text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none truncate"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {((att.sizeBytes || 0) / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => setEmailAttachments(emailAttachments.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Theme Configurator */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-500" />
                    Brand Theme &amp; Styling
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Injected into MJML/HTML</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Primary Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={emailBrandTheme.primaryColor || '#3b82f6'}
                        onChange={(e) => setEmailBrandTheme({ ...emailBrandTheme, primaryColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={emailBrandTheme.primaryColor || '#3b82f6'}
                        onChange={(e) => setEmailBrandTheme({ ...emailBrandTheme, primaryColor: e.target.value })}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Canvas Background</label>
                    <input
                      type="text"
                      value={emailBrandTheme.backgroundColor || '#f8fafc'}
                      onChange={(e) => setEmailBrandTheme({ ...emailBrandTheme, backgroundColor: e.target.value })}
                      placeholder="#f8fafc"
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. WHATSAPP BUILDER */}
          {activeChannel === 'whatsapp' && (
            <div className="space-y-4">
              {/* Header Configuration */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                    Header Component
                  </label>
                  <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded text-[11px]">
                    {(['image', 'text', 'document', 'video'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setWaHeaderType(type)}
                        className={`px-2 py-0.5 rounded capitalize ${
                          waHeaderType === type
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {waHeaderType === 'text' ? (
                  <input
                    type="text"
                    value={waHeaderText}
                    onChange={(e) => setWaHeaderText(e.target.value)}
                    placeholder="Header text with {{variables}}..."
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={waHeaderMediaUrl}
                    onChange={(e) => setWaHeaderMediaUrl(e.target.value)}
                    placeholder="Media URL (https://...)"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                )}
              </div>

              {/* Message Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">WhatsApp Rich Body</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    *bold*, _italic_, ~strike~, &#123;&#123;var&#125;&#125;
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={waBody}
                  onChange={(e) => setWaBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 custom-scrollbar leading-relaxed"
                />
              </div>

              {/* Footer */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Footer (Small Muted Text)
                </label>
                <input
                  type="text"
                  value={waFooter}
                  onChange={(e) => setWaFooter(e.target.value)}
                  placeholder="e.g. Reply STOP to opt out"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Interactive Buttons Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Interactive Buttons ({waButtons.length}/3)
                  </label>
                  {waButtons.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setWaButtons([
                          ...waButtons,
                          { type: 'quick_reply', text: 'New Button', id: `btn_${Date.now()}` },
                        ])
                      }
                      className="text-[11px] text-emerald-600 hover:text-emerald-500 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Button
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {waButtons.map((btn, idx) => (
                    <div
                      key={btn.id || idx}
                      className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2"
                    >
                      <select
                        value={btn.type}
                        onChange={(e) => {
                          const updated = [...waButtons];
                          updated[idx].type = e.target.value as WhatsAppButtonType;
                          setWaButtons(updated);
                        }}
                        className="text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1"
                      >
                        <option value="quick_reply">Quick Reply</option>
                        <option value="url">URL Link</option>
                        <option value="copy_code">Copy Code</option>
                        <option value="phone_number">Phone</option>
                      </select>

                      <input
                        type="text"
                        value={btn.text}
                        onChange={(e) => {
                          const updated = [...waButtons];
                          updated[idx].text = e.target.value;
                          setWaButtons(updated);
                        }}
                        placeholder="Button label..."
                        className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                      />

                      {btn.type === 'url' && (
                        <input
                          type="text"
                          value={btn.url || ''}
                          onChange={(e) => {
                            const updated = [...waButtons];
                            updated[idx].url = e.target.value;
                            setWaButtons(updated);
                          }}
                          placeholder="https://..."
                          className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => setWaButtons(waButtons.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive List Option */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Interactive List Button Label
                </label>
                <input
                  type="text"
                  value={waListButtonText}
                  onChange={(e) => setWaListButtonText(e.target.value)}
                  placeholder="e.g. Delivery Instructions 📋"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 3. PUSH NOTIFICATION BUILDER */}
          {activeChannel === 'push' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Push Title
                  </label>
                  <input
                    type="text"
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    iOS Subtitle
                  </label>
                  <input
                    type="text"
                    value={pushSubtitle}
                    onChange={(e) => setPushSubtitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Push Message Body
                </label>
                <textarea
                  rows={3}
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar"
                />
              </div>

              {/* Media & Action URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Big Image Banner (Rich Media URL)
                  </label>
                  <input
                    type="text"
                    value={pushImageUrl}
                    onChange={(e) => setPushImageUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deep Link Action URL
                  </label>
                  <input
                    type="text"
                    value={pushClickUrl}
                    onChange={(e) => setPushClickUrl(e.target.value)}
                    placeholder="convey://orders/123"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* APNs & FCM Specifics */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    iOS Interruption Level
                  </label>
                  <select
                    value={pushInterruption}
                    onChange={(e) => setPushInterruption(e.target.value as PushInterruptionLevel)}
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5"
                  >
                    <option value="passive">Passive (Silent in summary)</option>
                    <option value="active">Active (Standard banner)</option>
                    <option value="time-sensitive">Time-Sensitive (Bypasses Focus)</option>
                    <option value="critical">Critical (Max volume override)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Sound Payload
                  </label>
                  <input
                    type="text"
                    value={pushSound}
                    onChange={(e) => setPushSound(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                  />
                </div>
              </div>

              {/* Interactive Action Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Interactive Notification Actions ({pushActionButtons.length}/3)
                  </label>
                  {pushActionButtons.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPushActionButtons([
                          ...pushActionButtons,
                          { id: `act_${Date.now()}`, title: 'Quick Action', icon: 'zap' },
                        ])
                      }
                      className="text-[11px] text-indigo-600 hover:text-indigo-500 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Action
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {pushActionButtons.map((btn, idx) => (
                    <div
                      key={btn.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={btn.title}
                        onChange={(e) => {
                          const updated = [...pushActionButtons];
                          updated[idx].title = e.target.value;
                          setPushActionButtons(updated);
                        }}
                        placeholder="Action title..."
                        className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => setPushActionButtons(pushActionButtons.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. SMS BUILDER */}
          {activeChannel === 'sms' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">SMS Body</label>
              <textarea
                rows={5}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar"
              />
            </div>
          )}

          {/* Mock Variables Context */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Live Mock Variables &amp; Context
            </label>
            <textarea
              rows={4}
              value={variablesJson}
              onChange={(e) => setVariablesJson(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar"
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-400" />
              <select
                value={activeLocale}
                onChange={(e) => setActiveLocale(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none font-medium"
              >
                <option value="en-US">en-US (English)</option>
                <option value="es-ES">es-ES (Spanish)</option>
                <option value="de-DE">de-DE (German)</option>
                <option value="fr-FR">fr-FR (French)</option>
                <option value="pt-BR">pt-BR (Portuguese)</option>
                <option value="ar">ar (Arabic)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleTestRender}
              disabled={isRendering}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Compile &amp; Render Preview
            </button>
          </div>
        </div>

        {/* Right Column: Hyper-Realistic Live Device Preview Frame */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                Live Device Output
              </h2>
            </div>

            {/* Device switcher for Email */}
            {activeChannel === 'email' && (
              <div className="flex items-center gap-3 shrink-0">
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] shrink-0">
                  <button
                    type="button"
                    onClick={() => setEmailPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                      emailPreviewDevice === 'desktop'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5 shrink-0" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                      emailPreviewDevice === 'mobile'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span>Mobile</span>
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

                <button
                  type="button"
                  onClick={() => setEmailPreviewTheme(emailPreviewTheme === 'light' ? 'dark' : 'light')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                    emailPreviewTheme === 'dark'
                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                  title="Toggle Email Client Theme Simulation"
                >
                  {emailPreviewTheme === 'light' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Dark</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Device switcher for Push */}
            {activeChannel === 'push' && (
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setPushPreviewDevice('ios')}
                  className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition-all ${
                    pushPreviewDevice === 'ios'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span> iOS 18</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPushPreviewDevice('android')}
                  className={`px-2.5 py-1 rounded-md font-medium inline-flex items-center gap-1 shrink-0 whitespace-nowrap transition-all ${
                    pushPreviewDevice === 'android'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>🤖 Android 15</span>
                </button>
              </div>
            )}
          </div>

          {/* 1. HYPER-REALISTIC EMAIL CLIENT PREVIEW (Desktop macOS / Mobile iPhone) */}
          {activeChannel === 'email' && emailPreviewDevice === 'desktop' && (
            <div className="w-full bg-[#1e222b] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden text-slate-100 font-sans">
              {/* macOS Window Titlebar */}
              <div className="bg-[#181a20] px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-indigo-400" />
                  Mail — {emailFromName}
                </span>
                <div className="flex items-center gap-2 text-slate-500">
                  <Reply className="w-3.5 h-3.5 hover:text-slate-300 cursor-pointer" />
                  <Forward className="w-3.5 h-3.5 hover:text-slate-300 cursor-pointer" />
                  <Archive className="w-3.5 h-3.5 hover:text-slate-300 cursor-pointer" />
                </div>
              </div>

              {/* Email Envelope Metadata Header */}
              <div className="p-4 bg-[#1f232d] border-b border-slate-700/40 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-linear-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                      {emailFromName.charAt(0) || 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{emailFromName}</span>
                        <span className="text-[11px] text-slate-400 font-mono">&lt;{emailFromAddress}&gt;</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span>To: Alex Mercer &lt;alex@example.com&gt;</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">18:42 (Just now)</span>
                </div>

                <div className="pt-1">
                  <div className="font-bold text-sm text-slate-100">
                    {renderedOutput?.renderedEmail?.subject || emailSubject}
                  </div>
                  {renderedOutput?.renderedEmail?.previewText && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {renderedOutput.renderedEmail.previewText}
                    </div>
                  )}
                </div>

                {/* Attached Files Tray */}
                {emailAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {emailAttachments.map((att) => (
                      <div
                        key={att.contentId || att.filename}
                        className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 rounded-lg flex items-center gap-1.5 text-[11px] text-slate-200 shadow-xs transition-colors"
                      >
                        <Paperclip className="w-3 h-3 text-indigo-400" />
                        <span className="font-mono truncate max-w-[140px]">{att.filename}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {((att.sizeBytes || 0) / 1024).toFixed(0)}KB
                        </span>
                        <Download className="w-3 h-3 text-slate-400 hover:text-white cursor-pointer ml-0.5" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rendered HTML Email Body */}
              <div
                className={`w-full h-[400px] overflow-hidden transition-colors ${
                  emailPreviewTheme === 'dark' ? 'bg-[#0b0f19]' : 'bg-[#f8fafc]'
                }`}
              >
                <iframe
                  key={`desktop-${emailPreviewTheme}-${renderedOutput?.html?.length || 0}`}
                  title="Rendered Email Output"
                  srcDoc={getThemedEmailHtml(renderedOutput?.html, emailPreviewTheme)}
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          )}

          {activeChannel === 'email' && emailPreviewDevice === 'mobile' && (
            <div className="w-full bg-[#121214] rounded-3xl p-3 shadow-2xl border border-slate-700 text-white font-sans max-w-sm mx-auto overflow-hidden">
              {/* iPhone Notch & Status Bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-300 px-3 pt-1 pb-2">
                <span className="font-semibold">18:42</span>
                <div className="w-16 h-3.5 bg-black rounded-full mx-auto" />
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* iOS Mail Top Bar */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800 text-indigo-400 text-xs">
                <span className="flex items-center gap-1 cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5" /> Inbox
                </span>
                <div className="flex items-center gap-3 text-slate-400">
                  <Trash2 className="w-3.5 h-3.5" />
                  <Reply className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Mobile Subject & From */}
              <div className="p-3 space-y-1.5 border-b border-slate-800">
                <div className="font-bold text-xs text-white leading-tight">
                  {renderedOutput?.renderedEmail?.subject || emailSubject}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-[10px]">
                    {emailFromName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 truncate">{emailFromName}</div>
                    <div className="text-[9px] text-slate-400 truncate">To: Alex Mercer</div>
                  </div>
                </div>
              </div>

              {/* Mobile HTML Render */}
              <div
                className={`w-full h-[360px] rounded-xl overflow-hidden mt-2 transition-colors ${
                  emailPreviewTheme === 'dark' ? 'bg-[#0b0f19]' : 'bg-white'
                }`}
              >
                <iframe
                  key={`mobile-${emailPreviewTheme}-${renderedOutput?.html?.length || 0}`}
                  title="Mobile Email Output"
                  srcDoc={getThemedEmailHtml(renderedOutput?.html, emailPreviewTheme)}
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          )}

          {/* 2. WHATSAPP MOCKUP PREVIEW */}
          {activeChannel === 'whatsapp' && (
            <div className="w-full bg-[#0b141a] rounded-2xl p-4 shadow-xl border border-slate-800 text-slate-100 relative overflow-hidden font-sans">
              {/* WhatsApp Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                  C
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                    Convey Business
                    <span className="w-3.5 h-3.5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px]">
                      ✓
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400">Official Business Account</div>
                </div>
              </div>

              {/* Chat Bubble Container */}
              <div className="space-y-2">
                <div className="bg-[#202c33] rounded-xl rounded-tl-none p-3 shadow-md border border-white/5 space-y-2 max-w-[92%] relative">
                  {/* WhatsApp Media Header */}
                  {renderedOutput?.renderedWhatsApp?.header?.type === 'image' && (
                    <div className="rounded-lg overflow-hidden border border-white/10">
                      <img
                        src={renderedOutput.renderedWhatsApp.header.mediaUrl || waHeaderMediaUrl}
                        alt="Header Banner"
                        className="w-full h-36 object-cover"
                      />
                    </div>
                  )}

                  {renderedOutput?.renderedWhatsApp?.header?.type === 'text' && (
                    <div className="font-bold text-xs text-white border-b border-white/10 pb-1">
                      {renderedOutput.renderedWhatsApp.header.text || waHeaderText}
                    </div>
                  )}

                  {/* WhatsApp Body */}
                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {renderedOutput?.renderedWhatsApp?.body || waBody}
                  </div>

                  {/* WhatsApp Footer */}
                  <div className="text-[10px] text-slate-400 pt-1">
                    {renderedOutput?.renderedWhatsApp?.footer || waFooter}
                  </div>

                  {/* Timestamp + Blue Double Ticks */}
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
                    <span>18:42</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                  </div>
                </div>

                {/* WhatsApp Action Buttons (Stacked below bubble) */}
                {renderedOutput?.renderedWhatsApp?.buttons && renderedOutput.renderedWhatsApp.buttons.length > 0 && (
                  <div className="space-y-1.5 max-w-[92%]">
                    {renderedOutput.renderedWhatsApp.buttons.map((btn: WhatsAppButton, i: number) => (
                      <button
                        key={btn.id || i}
                        type="button"
                        onClick={() => toast.success(`Simulated action: ${btn.text}`)}
                        className="w-full py-2 px-3 bg-[#202c33] hover:bg-[#2a3942] active:scale-[0.98] text-[#53bdeb] text-xs font-medium rounded-lg border border-white/5 shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        {btn.type === 'url' && <ExternalLink className="w-3.5 h-3.5" />}
                        {btn.type === 'copy_code' && <Copy className="w-3.5 h-3.5" />}
                        {btn.type === 'phone_number' && <Phone className="w-3.5 h-3.5" />}
                        {btn.type === 'quick_reply' && <MessageSquare className="w-3.5 h-3.5" />}
                        {btn.text}
                      </button>
                    ))}
                  </div>
                )}

                {/* Interactive List Button */}
                {renderedOutput?.renderedWhatsApp?.interactiveList && (
                  <div className="max-w-[92%]">
                    <button
                      type="button"
                      onClick={() => setIsWhatsAppListOpen(!isWhatsAppListOpen)}
                      className="w-full py-2 px-3 bg-[#202c33] hover:bg-[#2a3942] active:scale-[0.98] text-[#53bdeb] text-xs font-semibold rounded-lg border border-white/5 shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ListFilter className="w-3.5 h-3.5" />
                      {renderedOutput.renderedWhatsApp.interactiveList.buttonText}
                    </button>
                  </div>
                )}

                {/* Interactive List Drawer Simulator */}
                {isWhatsAppListOpen && (
                  <div className="bg-[#111b21] p-3 rounded-xl border border-white/10 space-y-2 mt-2 max-w-[92%] animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Select an Option:
                    </div>
                    {renderedOutput?.renderedWhatsApp?.interactiveList?.sections[0]?.rows.map(
                      (row: WhatsAppListRow) => (
                        <div
                          key={row.id}
                          onClick={() => {
                            toast.success(`Selected: ${row.title}`);
                            setIsWhatsAppListOpen(false);
                          }}
                          className="p-2 bg-[#202c33] hover:bg-[#2a3942] rounded-lg cursor-pointer transition-all"
                        >
                          <div className="text-xs font-medium text-white">{row.title}</div>
                          {row.description && <div className="text-[10px] text-slate-400">{row.description}</div>}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. PUSH NOTIFICATION PREVIEW (iOS / Android) */}
          {activeChannel === 'push' && pushPreviewDevice === 'ios' && (
            <div className="w-full bg-linear-to-b from-slate-900 to-indigo-950 rounded-3xl p-4 shadow-2xl border border-slate-700 text-white relative font-sans overflow-hidden">
              {/* iOS Lock Screen Time Header */}
              <div className="text-center pt-2 pb-4">
                <div className="text-3xl font-light tracking-tight text-slate-200">18:42</div>
                <div className="text-[11px] text-slate-400 font-medium">Wednesday, August 26</div>
              </div>

              {/* iOS Frosted Glass Notification Card */}
              <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-3.5 border border-white/20 shadow-lg space-y-2.5">
                {/* Header row: App Icon, Name, Time, Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                      C
                    </div>
                    <span className="text-xs font-semibold text-slate-100 tracking-tight">CONVEY</span>
                    <span className="text-[10px] text-slate-400 font-medium">• 2m ago</span>
                  </div>

                  {renderedOutput?.renderedPush?.interruptionLevel === 'time-sensitive' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold uppercase tracking-wider border border-amber-500/30">
                      Time-Sensitive
                    </span>
                  )}
                </div>

                {/* Push Title & Subtitle */}
                <div>
                  <div className="text-xs font-bold text-white">{renderedOutput?.renderedPush?.title || pushTitle}</div>
                  {renderedOutput?.renderedPush?.subtitle && (
                    <div className="text-[11px] font-medium text-slate-300">{renderedOutput.renderedPush.subtitle}</div>
                  )}
                </div>

                {/* Push Body */}
                <div className="text-xs text-slate-200 leading-snug">
                  {renderedOutput?.renderedPush?.body || pushBody}
                </div>

                {/* Big Media Banner */}
                {renderedOutput?.renderedPush?.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10 mt-2">
                    <img src={renderedOutput.renderedPush.imageUrl} alt="Banner" className="w-full h-32 object-cover" />
                  </div>
                )}

                {/* Action Buttons */}
                {renderedOutput?.renderedPush?.actionButtons &&
                  renderedOutput.renderedPush.actionButtons.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                      {renderedOutput.renderedPush.actionButtons.map((btn: PushActionButton) => (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => toast.success(`Triggered push action: ${btn.title}`)}
                          className="py-1.5 px-2 bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-medium rounded-lg text-center transition-all"
                        >
                          {btn.title}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeChannel === 'push' && pushPreviewDevice === 'android' && (
            <div className="w-full bg-[#121316] rounded-2xl p-4 shadow-2xl border border-slate-800 text-slate-200 relative font-sans">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800 mb-3">
                <span className="font-mono">18:42</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Bell className="w-3.5 h-3.5 text-indigo-400" /> Convey
                </span>
              </div>

              {/* Material You Notification Card */}
              <div className="bg-[#1f2024] rounded-xl p-3.5 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                      C
                    </div>
                    <span className="text-xs font-medium text-slate-400">Convey • now</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </div>

                <div>
                  <div className="text-xs font-bold text-white">{renderedOutput?.renderedPush?.title || pushTitle}</div>
                  <div className="text-xs text-slate-300 mt-0.5">{renderedOutput?.renderedPush?.body || pushBody}</div>
                </div>

                {renderedOutput?.renderedPush?.imageUrl && (
                  <div className="rounded-lg overflow-hidden mt-2">
                    <img src={renderedOutput.renderedPush.imageUrl} alt="Banner" className="w-full h-32 object-cover" />
                  </div>
                )}

                {/* Android Action Pills */}
                {renderedOutput?.renderedPush?.actionButtons && (
                  <div className="flex gap-2 pt-2">
                    {renderedOutput.renderedPush.actionButtons.map((btn: PushActionButton) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => toast.success(`Android action: ${btn.title}`)}
                        className="px-3 py-1 bg-[#2c2d33] hover:bg-[#383940] text-indigo-300 text-[11px] font-semibold rounded-full transition-all"
                      >
                        {btn.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. SMS PREVIEW */}
          {activeChannel === 'sms' && (
            <div className="w-full bg-[#1c1c1e] rounded-3xl p-4 shadow-xl border border-slate-700 text-white font-sans">
              <div className="text-center text-[10px] text-slate-400 pb-3">Today 18:42</div>
              <div className="bg-[#34c759] text-white p-3 rounded-2xl rounded-br-none text-xs leading-relaxed max-w-[85%] ml-auto shadow-md">
                {renderedOutput?.body || smsBody}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Template */}
      {isCreatingNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Notification Template</h3>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Order Delivery Update"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().trim().replace(/\s+/g, '_'));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unique Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. order_delivery_update"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm"
                >
                  Save &amp; Open Studio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: API Integration Code Snippet */}
      {isApiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-bold">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>API &amp; SDK Sample Code</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dispatch notifications in real-time using template{' '}
                    <span className="font-mono text-indigo-500 font-semibold">
                      {selectedTemplate?.slug || 'order_dispatch_alert'}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApiModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
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
                        ? 'go get github.com/hamidrezakks/convey/packages/sdk-go'
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
