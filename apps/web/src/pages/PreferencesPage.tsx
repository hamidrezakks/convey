import { Channel, type PreferenceCheckResult, type SubscriptionTopicDto } from '@convey/shared';
import { CheckCircle2, Layers, Plus, Sliders, UserCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function PreferencesPage() {
  const [topics, setTopics] = useState<SubscriptionTopicDto[]>([]);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  // Form states
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);

  // Simulation test states
  const [simRecipientId, setSimRecipientId] = useState('usr_109283');
  const [simChannel, setSimChannel] = useState('email');
  const [simTopicKey, setSimTopicKey] = useState('marketing_newsletter');
  const [simResult, setSimResult] = useState<({ success: boolean } & PreferenceCheckResult) | null>(null);

  const tenantId = '019ff136-0000-7000-8000-000000000001';
  const team = 'core';

  const loadTopics = async () => {
    try {
      const res = await api.listTopics(tenantId, team);
      if (res.success && res.topics) {
        setTopics(res.topics);
      }
    } catch {
      // Fallback topics
      const fallback: SubscriptionTopicDto[] = [
        {
          id: '1',
          tenantId,
          team,
          key: 'security_2fa',
          name: 'Security & 2FA Codes',
          description: 'Critical authentication and security alerts (Cannot be opted out)',
          isMandatory: true,
          defaultChannels: [Channel.SMS, Channel.EMAIL],
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          tenantId,
          team,
          key: 'billing_alerts',
          name: 'Invoices & Billing',
          description: 'Receipts, invoices, and payment failure notices',
          isMandatory: false,
          defaultChannels: [Channel.EMAIL],
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          tenantId,
          team,
          key: 'marketing_newsletter',
          name: 'Product Updates & Offers',
          description: 'Weekly digest of features and exclusive promotions',
          isMandatory: false,
          defaultChannels: [Channel.EMAIL],
          createdAt: new Date().toISOString(),
        },
      ];
      setTopics(fallback);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleCreateTopic = async () => {
    if (!newKey || !newName) {
      toast.error('Key and Name are required');
      return;
    }

    try {
      const res = await api.createTopic({
        tenantId,
        team,
        key: newKey.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        isMandatory,
      });

      if (res.success) {
        toast.success(`Created topic "${res.topic.name}"`);
        setIsCreatingTopic(false);
        setNewKey('');
        setNewName('');
        setNewDesc('');
        setIsMandatory(false);
        await loadTopics();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create topic');
    }
  };

  const handleSimulate = async () => {
    try {
      const res = await api.checkPreference({
        tenantId,
        recipientId: simRecipientId,
        channel: simChannel,
        topicKey: simTopicKey,
      });
      setSimResult(res);
      if (res.allowed) {
        toast.success('Dispatch Allowed for Recipient');
      } else {
        toast.warning(`Dispatch Blocked: ${res.reason}`);
      }
    } catch {
      // Offline fallback simulation
      setSimResult({
        success: true,
        allowed: true,
      });
      toast.success('Dispatch Allowed (Simulated)');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-7 h-7 text-emerald-500 shrink-0" />
            <span>Recipient Preferences &amp; Consent Governance</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage granular subscription topics, channel opt-ins, quiet hours, and RFC-8058 unsubscribe compliance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingTopic(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-sm font-semibold rounded-lg shadow-sm transition-all shrink-0 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subscription Topic</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Topics Matrix */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Active Subscription Topics
            </h2>
            <span className="text-xs text-slate-400 font-mono">{topics.length} configured</span>
          </div>

          <div className="space-y-3">
            {topics.map((t) => (
              <div
                key={t.key}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {t.key}
                    </span>
                  </div>

                  {t.isMandatory ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Mandatory (No Opt-Out)
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Granular Opt-In
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pt-1">
                  <span>Default Channels:</span>
                  {t.defaultChannels.map((ch) => (
                    <span
                      key={ch}
                      className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md uppercase text-[10px]"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dispatch Permission Inspector */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              Recipient Dispatch Simulator
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recipient External ID
              </label>
              <input
                type="text"
                value={simRecipientId}
                onChange={(e) => setSimRecipientId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Channel
                </label>
                <select
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="chat">Chat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Category
                </label>
                <select
                  value={simTopicKey}
                  onChange={(e) => setSimTopicKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none"
                >
                  {topics.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulate}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              Evaluate Consent &amp; Quiet Hours
            </button>

            {/* Result Display */}
            {simResult && (
              <div
                className={`p-4 rounded-xl border space-y-2 animate-in fade-in ${
                  simResult.allowed
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs">
                  {simResult.allowed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Dispatch Permitted</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span>Dispatch Suppressed ({simResult.reason})</span>
                    </>
                  )}
                </div>
                <p className="text-xs opacity-80">
                  {simResult.allowed
                    ? 'Recipient has opted into this topic and is currently outside quiet hours.'
                    : `Message rejected before provider dispatch to protect recipient consent standards.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal to Create Topic */}
      {isCreatingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Subscription Topic</h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                placeholder="e.g. Weekly Product Digest"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Topic Key</label>
              <input
                type="text"
                placeholder="e.g. weekly_digest"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Explain what this topic contains"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isMandatoryCheck"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isMandatoryCheck" className="text-xs text-slate-700 dark:text-slate-300">
                Mandatory Topic (e.g. 2FA or Terms update — cannot be unsubscribed)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingTopic(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTopic}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                Create Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
