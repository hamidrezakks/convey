import {
  Channel,
  type PushActionButton,
  type PushChannelConfig,
  type PushInterruptionLevel,
  type RenderTemplateResponse,
  type TemplateDto,
  type WhatsAppButton,
  type WhatsAppButtonType,
  type WhatsAppChannelConfig,
  type WhatsAppHeaderType,
} from '@convey/shared';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  ImageIcon,
  ListFilter,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function TemplateStudioPage() {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Active channel tab
  const [activeChannel, setActiveChannel] = useState<'email' | 'sms' | 'push' | 'whatsapp'>('whatsapp');
  const [previewDevice, setPreviewDevice] = useState<'ios' | 'android'>('ios');
  const [isWhatsAppListOpen, setIsWhatsAppListOpen] = useState(false);

  // 1. Email Channel States
  const [emailSubject, setEmailSubject] = useState('Order #{{orderId}} Confirmation');
  const [emailMjml, setEmailMjml] = useState(
    `<mjml>
  <mj-body>
    <mj-section background-color="#f8fafc">
      <mj-column width="100%">
        <mj-text font-size="22px" font-weight="700" color="#0f172a">Your order is confirmed!</mj-text>
        <mj-text font-size="15px" color="#334155">Hi {{recipient.name}}, thanks for your purchase of {{itemsCount}} items totaling {{amount | currency: 'USD'}}.</mj-text>
        <mj-button href="{{trackingUrl}}" background-color="#3b82f6" border-radius="6px">Track Order</mj-button>
        <mj-divider border-color="#e2e8f0" />
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  );

  // 2. SMS Channel States
  const [smsBody, setSmsBody] = useState(
    'Order #{{orderId}} confirmed! Total: ${{amount}}. Track delivery: {{trackingUrl}}',
  );

  // 3. WhatsApp Channel States (Rich Interactive Components)
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

  // 4. Push Channel States (Rich APNs & FCM Components)
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

  // Mock Variables Context
  const [variablesJson, setVariablesJson] = useState(
    JSON.stringify(
      {
        orderId: 'ORD-9942',
        itemsCount: 3,
        amount: 184.5,
        courierName: 'Marcus Vance',
        deliveryPin: '8492',
        trackingUrl: 'https://convey.dev/track/ORD-9942',
        recipient: { name: 'Alex Mercer', phone: '+14155552671', email: 'alex@example.com' },
      },
      null,
      2,
    ),
  );

  const [renderedOutput, setRenderedOutput] = useState<RenderTemplateResponse | null>(null);
  const [activeLocale, setActiveLocale] = useState('en-US');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');

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
              email: { subject: 'Order Confirmation', html: '<p>Thank you for your order!</p>' },
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
          email: { subject: emailSubject, mjml: emailMjml },
          sms: { body: smsBody },
          whatsapp: waSpec,
          push: pushSpec,
        },
        variables: parsedVars,
        locale: activeLocale,
      });

      if (res.success && res.rendered) {
        setRenderedOutput(res.rendered);
        toast.success(`Template compiled for ${activeChannel.toUpperCase()} (${res.rendered.localeUsed})`);
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
            email: { subject: emailSubject, mjml: emailMjml },
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Multi-Channel Template Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              AST &amp; MJML v2.4
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise content registry with draft/publish versioning, rich WhatsApp components, APNs/FCM interactive
            push notifications, and MJML compilation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create New Template
        </button>
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
              {(['whatsapp', 'push', 'email', 'sms'] as const).map((ch) => (
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

          {/* 1. WHATSAPP BUILDER */}
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

          {/* 2. PUSH NOTIFICATION BUILDER */}
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

          {/* 3. EMAIL BUILDER */}
          {activeChannel === 'email' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  MJML Responsive Template
                </label>
                <textarea
                  rows={8}
                  value={emailMjml}
                  onChange={(e) => setEmailMjml(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar"
                />
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
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live Device Output</h2>
            </div>

            {activeChannel === 'push' && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('ios')}
                  className={`px-2 py-0.5 rounded font-medium ${
                    previewDevice === 'ios'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                   iOS 18
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('android')}
                  className={`px-2 py-0.5 rounded font-medium ${
                    previewDevice === 'android'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  🤖 Android 15
                </button>
              </div>
            )}
          </div>

          {/* 1. WHATSAPP MOCKUP PREVIEW */}
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
                    {renderedOutput.renderedWhatsApp.buttons.map((btn, i) => (
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
                    {renderedOutput?.renderedWhatsApp?.interactiveList?.sections[0]?.rows.map((row) => (
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
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. PUSH NOTIFICATION PREVIEW (iOS / Android) */}
          {activeChannel === 'push' && previewDevice === 'ios' && (
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
                      {renderedOutput.renderedPush.actionButtons.map((btn) => (
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

          {activeChannel === 'push' && previewDevice === 'android' && (
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
                    {renderedOutput.renderedPush.actionButtons.map((btn) => (
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

          {/* 3. EMAIL HTML PREVIEW */}
          {activeChannel === 'email' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono border-b border-slate-200 dark:border-slate-800 pb-2">
                Subject:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {renderedOutput?.subject || emailSubject}
                </span>
              </div>
              <div className="w-full h-[460px] bg-white rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                <iframe
                  title="Rendered Email HTML"
                  srcDoc={renderedOutput?.html || '<p style="padding: 20px; font-family: sans-serif;">Rendering...</p>'}
                  className="w-full h-full border-none"
                />
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
    </div>
  );
}
