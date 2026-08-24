import { Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, formatNumber } from '../../lib/utils';
import { Badge } from '../ui/Badge';

export function WhatsAppRoiCalculator() {
  const [monthlyVolume, setMonthlyVolume] = useState<number>(250000);
  const [engagementRate, setEngagementRate] = useState<number>(45);
  const [templateFee, setTemplateFee] = useState<number>(0.055);

  // Calculations
  const traditionalCost = monthlyVolume * templateFee;
  const freeSessionMessages = monthlyVolume * (engagementRate / 100);
  const remainingPaidMessages = monthlyVolume - freeSessionMessages;
  const conveyCost = remainingPaidMessages * templateFee;
  const monthlySavings = traditionalCost - conveyCost;
  const annualSavings = monthlySavings * 12;
  const savingsPercent = Math.round((monthlySavings / traditionalCost) * 100);

  return (
    <section className="py-20 bg-[#080c14] border-t border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Title */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous WhatsApp 24h Cost Autopilot</span>
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Calculate Your WhatsApp Delivery Savings
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Convey automatically intercepts outbound WhatsApp messages to engaged users and delivers them as{' '}
            <strong>$0.00 plain-text session messages</strong> instead of paying expensive Meta template fees ($0.03 -
            $0.08).
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 sm:p-8 shadow-2xl glass-panel">
          {/* Left: Input Sliders */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Messaging Volume & Traffic Profile
              </span>
              <Badge variant="outline" size="sm">
                Real-Time ROI
              </Badge>
            </div>

            {/* Monthly Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-300">Monthly WhatsApp Dispatches</label>
                <span className="font-mono font-bold text-sky-400 text-sm">{formatNumber(monthlyVolume)} msgs/mo</span>
              </div>
              <input
                type="range"
                min="10000"
                max="2000000"
                step="10000"
                value={monthlyVolume}
                onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>10k</span>
                <span>500k</span>
                <span>1M</span>
                <span>2M+</span>
              </div>
            </div>

            {/* Engagement Rate Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-300">24h Customer Reply / Interaction Rate</label>
                <span className="font-mono font-bold text-emerald-400 text-sm">{engagementRate}% within 24h</span>
              </div>
              <input
                type="range"
                min="5"
                max="90"
                step="5"
                value={engagementRate}
                onChange={(e) => setEngagementRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>5% (Low)</span>
                <span>45% (Typical E-commerce)</span>
                <span>90% (Active Support)</span>
              </div>
            </div>

            {/* Meta Template Fee Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-300">Average Meta Template Fee (per msg)</label>
                <span className="font-mono font-bold text-purple-400 text-sm">${templateFee.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.03"
                max="0.09"
                step="0.005"
                value={templateFee}
                onChange={(e) => setTemplateFee(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>$0.030 (Utility)</span>
                <span>$0.055 (Standard)</span>
                <span>$0.090 (Marketing)</span>
              </div>
            </div>
          </div>

          {/* Right: Real-Time Savings Summary */}
          <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#070b12] p-6 flex flex-col justify-between space-y-6 shadow-inner">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Estimated Cost Reduction
              </div>

              {/* Big Savings Callout */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent border border-emerald-500/30 space-y-1">
                <div className="text-xs text-emerald-400 font-semibold font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Annual Net Expenditure Savings</span>
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
                  {formatCurrency(annualSavings)}
                  <span className="text-sm font-normal text-slate-400 font-sans ml-2">/ year</span>
                </div>
                <div className="text-xs text-slate-300 pt-1">
                  You save <strong className="text-emerald-300">{formatCurrency(monthlySavings)}/mo</strong> (
                  {savingsPercent}% reduction) with zero code changes!
                </div>
              </div>

              {/* Comparison Bar */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Traditional Monolith / Twilio (100% Template Fee):</span>
                    <span className="font-mono text-rose-400 font-bold">{formatCurrency(traditionalCost)}/mo</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-rose-500 w-full rounded-full" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Convey Autonomous 24h Session Autopilot:</span>
                    <span className="font-mono text-emerald-400 font-bold">{formatCurrency(conveyCost)}/mo</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full transition-all duration-300"
                      style={{ width: `${100 - savingsPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation Note */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">How it works</strong>: Convey monitors inbound customer replies via
              webhooks and sets an in-memory 24-hour session lease in Redis. Outbound messages during this window are
              transformed into $0.00 plain text session messages automatically.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
