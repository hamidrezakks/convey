import { Channel } from '@convey/shared';
import { Bell, Bot, Check, Laptop, MessageCircle, MessageSquare, Phone, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/context';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

export interface OmnichannelPreviewProps {
  channel: Channel;
  recipient: string;
  subject?: string;
  body: string;
  variables?: Record<string, string | number | boolean>;
}

export function OmnichannelPreview({ channel, recipient, subject, body, variables = {} }: OmnichannelPreviewProps) {
  const { t } = useI18n();
  const [deviceViewport, setDeviceViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Interpolate variables {{var}}
  const renderInterpolated = (template?: string) => {
    if (!template) return '';
    let output = template;
    for (const [k, v] of Object.entries(variables)) {
      const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      output = output.replace(new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'g'), String(v));
    }
    return output;
  };

  const renderedSubject = renderInterpolated(subject);
  const renderedBody = renderInterpolated(body);

  // SMS GSM-7 Segment Calculation
  const smsLength = renderedBody.length;
  const isGsm7 = /^[\x20-\x7E\r\n]*$/.test(renderedBody);
  const maxSegmentChars = isGsm7 ? 160 : 70;
  const segmentsCount = Math.ceil(smsLength / maxSegmentChars) || 1;

  return (
    <div className="space-y-3">
      {/* Frame Header & Viewport Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="cyan">{channel}</Badge>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px] sm:max-w-xs">
            {recipient}
          </span>
        </div>

        {channel === Channel.EMAIL && (
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setDeviceViewport('desktop')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors cursor-pointer',
                deviceViewport === 'desktop'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
              title={t('composer.desktopView')}
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('mobile')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors cursor-pointer',
                deviceViewport === 'mobile'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
              title={t('composer.mobileView')}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {channel === Channel.SMS && (
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span>{smsLength} chars</span> •{' '}
            <span className="text-sky-600 dark:text-sky-400 font-semibold">
              {segmentsCount} {segmentsCount > 1 ? 'segments' : 'segment'}
            </span>
          </div>
        )}
      </div>

      {/* Frame Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-4 min-h-[380px] flex items-center justify-center overflow-x-auto transition-colors duration-150">
        {/* EMAIL PREVIEW */}
        {channel === Channel.EMAIL && (
          <div
            className={cn(
              'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl dark:shadow-2xl overflow-hidden transition-all duration-300',
              deviceViewport === 'mobile' ? 'max-w-[360px]' : 'max-w-[580px]',
            )}
          >
            {/* Email Client Header */}
            <div className="bg-slate-50 dark:bg-slate-950/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {renderedSubject || '(No Subject)'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">Just now</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <span className="font-semibold text-slate-800 dark:text-slate-300">Convey Notifications</span>
                <span>&lt;notifications@convey.io&gt;</span>
              </div>
            </div>
            {/* Email HTML Body */}
            <div
              className="p-5 text-sm text-slate-800 dark:text-slate-200 prose prose-slate dark:prose-invert max-w-none min-h-[220px]"
              dangerouslySetInnerHTML={{
                __html: renderedBody || '<p class="text-slate-400 dark:text-slate-500">Compose an email message...</p>',
              }}
            />
          </div>
        )}

        {/* SMS PREVIEW */}
        {channel === Channel.SMS && (
          <div className="w-full max-w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-3 shadow-xl dark:shadow-2xl space-y-4">
            {/* Phone Screen Notch & Status Bar */}
            <div className="flex items-center justify-between px-3 pt-1 text-[10px] text-slate-400 font-mono">
              <span>9:41</span>
              <div className="w-12 h-3.5 bg-slate-200 dark:bg-slate-950 rounded-full" />
              <span>5G 100%</span>
            </div>

            {/* Sender Header */}
            <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-full bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-1 font-bold text-xs border border-sky-500/20 dark:border-sky-500/30">
                <Phone className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Convey SMS</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {recipient || '+1 (555) 019-2831'}
              </p>
            </div>

            {/* Message Bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] p-3 rounded-2xl rounded-tl-sm bg-sky-600 text-white text-xs leading-relaxed shadow-md">
                {renderedBody || 'Your verification code is 849201. Valid for 10 minutes.'}
                <div className="text-[9px] text-sky-200 text-right mt-1">9:41 AM</div>
              </div>
            </div>
          </div>
        )}

        {/* WHATSAPP PREVIEW */}
        {channel === Channel.WHATSAPP && (
          <div className="w-full max-w-[340px] bg-[#0c1317] border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl">
            {/* WhatsApp Green Top Bar */}
            <div className="bg-[#1f2c34] px-4 py-2.5 flex items-center gap-3 border-b border-[#2a3942]">
              <div className="w-8 h-8 rounded-full bg-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white truncate">Convey Verified</span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[8px] font-bold shrink-0">
                    ✓
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">Official Business Account</p>
              </div>
            </div>

            {/* Chat Area */}
            <div className="p-4 space-y-3 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px] min-h-[260px]">
              <div className="p-3 rounded-xl rounded-tl-sm bg-[#005c4b] text-slate-100 text-xs leading-relaxed shadow-md">
                {renderedBody || 'Hello! Your order #91823 has been shipped.'}
                <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200 mt-1">
                  <span>9:41 AM</span>
                  <Check className="w-3 h-3 text-emerald-300" />
                </div>
              </div>

              {/* WhatsApp Quick Action Buttons */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  className="w-full py-1.5 rounded-lg bg-[#1f2c34] hover:bg-[#2a3942] text-[#00a884] text-xs font-semibold border border-[#2a3942] transition-colors cursor-pointer"
                >
                  Track Shipment 📦
                </button>
                <button
                  type="button"
                  className="w-full py-1.5 rounded-lg bg-[#1f2c34] hover:bg-[#2a3942] text-[#00a884] text-xs font-semibold border border-[#2a3942] transition-colors cursor-pointer"
                >
                  Manage Order
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IN-APP CHAT PREVIEW */}
        {channel === Channel.CHAT && (
          <div className="w-full max-w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 p-3.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">{renderedSubject || 'Convey Live Support'}</h4>
                  <div className="flex items-center gap-1 text-[10px] text-sky-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Agent Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation */}
            <div className="p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50 min-h-[220px]">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-xs shadow-xs max-w-[85%] leading-relaxed">
                  {renderedBody || 'Hello! How can we help you today?'}
                  <div className="text-[9px] text-slate-400 text-right mt-1">Just now</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLACK PREVIEW */}
        {channel === Channel.SLACK && (
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                BOT
              </div>
              <div className="space-y-1 w-full min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Convey Bot</span>
                  <span className="text-[10px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                    APP
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">9:41 AM</span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border-l-4 border-sky-500 text-xs text-slate-800 dark:text-slate-200 space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {renderedSubject || 'System Alert: High Priority Event'}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {renderedBody || 'Traffic surge detected on cluster node #us-east-1a.'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] cursor-pointer"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 font-medium text-[11px] border border-slate-300 dark:border-slate-700 cursor-pointer"
                    >
                      View Grafana
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PUSH PREVIEW */}
        {channel === Channel.PUSH && (
          <div className="w-full max-w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl dark:shadow-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-sky-500 flex items-center justify-center text-slate-950 font-bold text-[9px]">
                  <Bell className="w-2.5 h-2.5 text-slate-950" />
                </div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">CONVEY</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">now</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {renderedSubject || 'Order Confirmation'}
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                {renderedBody || 'Your order has been placed successfully.'}
              </p>
            </div>
          </div>
        )}

        {/* TOOL / WEBHOOK PREVIEW */}
        {channel === Channel.TOOL && (
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xl overflow-hidden">
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400 mb-2 font-semibold">
              POST /v1/webhook_dispatch
            </div>
            <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-800/80">
              {JSON.stringify(
                {
                  event: 'tool.dispatch',
                  recipient,
                  payload: {
                    subject: renderedSubject,
                    body: renderedBody,
                    variables,
                  },
                  timestamp: new Date().toISOString(),
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
