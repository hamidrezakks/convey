import type { Channel, RenderTemplateResponse, TemplateDto } from '@convey/shared';
import { Code2, Eye, FileCode, Globe, Loader2, Plus, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function TemplateStudioPage() {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Editor states
  const [activeChannel, setActiveChannel] = useState<'email' | 'sms' | 'push' | 'whatsapp'>('email');
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
  const [smsBody, setSmsBody] = useState('Order #{{orderId}} confirmed! Track here: {{trackingUrl}}');
  const [variablesJson, setVariablesJson] = useState(
    JSON.stringify(
      {
        orderId: 'ORD-8829',
        itemsCount: 3,
        amount: 129.5,
        trackingUrl: 'https://convey.dev/track/ORD-8829',
        recipient: { name: 'Sarah Connor', email: 'sarah@example.com' },
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
          slug: 'order_confirmation',
          name: 'Order Confirmation',
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
        if (details.template.publishedVersion?.channels.email) {
          setEmailSubject(details.template.publishedVersion.channels.email.subject || '');
          if (details.template.publishedVersion.channels.email.mjml) {
            setEmailMjml(details.template.publishedVersion.channels.email.mjml);
          }
        }
        if (details.template.publishedVersion?.channels.sms) {
          setSmsBody(details.template.publishedVersion.channels.sms.body || '');
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleTestRender = async () => {
    setIsRendering(true);
    try {
      let parsedVars = {};
      try {
        parsedVars = JSON.parse(variablesJson);
      } catch {
        toast.error('Invalid JSON variables format');
        return;
      }

      const res = await api.renderTemplate({
        channel: activeChannel as Channel,
        templateSpec: {
          email: { subject: emailSubject, mjml: emailMjml },
          sms: { body: smsBody },
          push: { title: emailSubject, body: smsBody },
          whatsapp: { body: smsBody },
        },
        variables: parsedVars,
        locale: activeLocale,
      });

      if (res.success) {
        setRenderedOutput(res.rendered);
        toast.success(`Template compiled for ${activeChannel.toUpperCase()} (${res.rendered.localeUsed})`);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to render template');
    } finally {
      setIsRendering(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newSlug || !newName) {
      toast.error('Slug and Name are required');
      return;
    }

    try {
      const res = await api.createTemplate({
        slug: newSlug.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newName.trim(),
        category: 'transactional',
        initialVersion: {
          version: '1.0.0',
          channels: {
            email: { subject: emailSubject, mjml: emailMjml },
            sms: { body: smsBody },
          },
          changeSummary: 'Initial release',
        },
      });

      if (res.success) {
        toast.success(`Created template "${res.template.name}"`);
        setIsCreatingNew(false);
        setNewSlug('');
        setNewName('');
        await loadTemplates();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCode className="w-7 h-7 text-indigo-500" />
            Template Studio &amp; Lifecycle
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Design, version, translate, and test multi-channel notifications with instant MJML &amp; AST preview.
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
              {(['email', 'sms', 'push', 'whatsapp'] as const).map((ch) => (
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

          {/* Email Subject */}
          {activeChannel === 'email' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Channel Content Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {activeChannel === 'email' ? 'MJML Responsive Template' : 'Message Body'}
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                AST Tags: &#123;&#123;var&#125;&#125; &#123;% if %&#125;
              </span>
            </div>
            <textarea
              rows={12}
              value={activeChannel === 'email' ? emailMjml : smsBody}
              onChange={(e) => (activeChannel === 'email' ? setEmailMjml(e.target.value) : setSmsBody(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar leading-relaxed"
            />
          </div>

          {/* Mock Variables Form */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mock JSON Variables &amp; Context
            </label>
            <textarea
              rows={5}
              value={variablesJson}
              onChange={(e) => setVariablesJson(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 custom-scrollbar"
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-400" />
              <select
                value={activeLocale}
                onChange={(e) => setActiveLocale(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="en-US">en-US (Default)</option>
                <option value="es-ES">es-ES (Spanish)</option>
                <option value="de-DE">de-DE (German)</option>
                <option value="fr-FR">fr-FR (French)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleTestRender}
              disabled={isRendering}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Compile &amp; Render
            </button>
          </div>
        </div>

        {/* Right Column: Live Rendered Multi-Device Preview Frame */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live Device Output</h2>
            </div>
            {renderedOutput && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold font-mono">
                {renderedOutput.localeUsed}
              </span>
            )}
          </div>

          {/* Rendered Frame */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 min-h-[480px] flex flex-col justify-start">
            {renderedOutput ? (
              <div className="space-y-3 w-full">
                {renderedOutput.subject && (
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 pb-2">
                    Subject: {renderedOutput.subject}
                  </div>
                )}

                {activeChannel === 'email' && renderedOutput.html ? (
                  <iframe
                    title="Live Email Preview"
                    srcDoc={renderedOutput.html}
                    className="w-full h-[420px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                  />
                ) : (
                  <div className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-sans whitespace-pre-wrap leading-relaxed shadow-xs">
                    {renderedOutput.body}
                  </div>
                )}
              </div>
            ) : (
              <div className="m-auto text-center space-y-2 text-slate-400">
                <Code2 className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs">Click "Compile &amp; Render" to test template AST resolution</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create New Template</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                placeholder="e.g. Password Reset Alert"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Slug Key</label>
              <input
                type="text"
                placeholder="e.g. password_reset_v2"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
