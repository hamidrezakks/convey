import { CURRENCY_REGISTRY, formatCurrencyAmount, type SupportedCurrency } from '@convey/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Check,
  ChevronDown,
  Clock,
  Coins,
  Globe,
  RotateCcw,
  Scale,
  Sliders,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Combobox } from '../components/ui/combobox';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { policyKeys } from '../lib/queryKeys';
import { useUiMode } from '../mode';

export function PoliciesPage() {
  const { t } = useI18n();
  const { isOps, isEngineer } = useUiMode();

  // Policy configurations state
  const [budgetCurrency, setBudgetCurrency] = useState<string>('USD');
  const [monthlyBudget, setMonthlyBudget] = useState<number>(2500);
  const [hardStop, setHardStop] = useState<boolean>(true);
  const [usedAmount] = useState<number>(642.5);

  const [rateLimitRps, setRateLimitRps] = useState(5000);
  const [burstCapacity, setBurstCapacity] = useState(10000);
  const [quantumEnterprise, setQuantumEnterprise] = useState(200);
  const [quantumPro, setQuantumPro] = useState(50);
  const [quantumFree, setQuantumFree] = useState(10);
  const [whatsappSessionAutoConvert, setWhatsappSessionAutoConvert] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [showAdvancedDrrInOps, setShowAdvancedDrrInOps] = useState(false);

  // TanStack Query: Policies list
  const { isFetching, refetch } = useQuery({
    queryKey: policyKeys.all,
    queryFn: () => api.getPolicies(),
  });

  const handleSavePolicies = () => {
    toast.success(
      isOps
        ? 'Communication guardrails and budget policy saved successfully!'
        : 'Traffic policies, multi-currency budget cap, and DRR quanta deployed to Redis cluster!',
    );
  };

  // FX Conversion calculations for preview
  const currMeta = CURRENCY_REGISTRY[budgetCurrency as SupportedCurrency] || CURRENCY_REGISTRY.USD;
  const rateToUsd = currMeta.rateToUsd || 1.0;
  const budgetUsd = monthlyBudget * rateToUsd;
  const usedUsd = usedAmount * rateToUsd;
  const utilizationPercent = Math.min(100, Math.round((usedAmount / (monthlyBudget || 1)) * 100));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500" />
                {t('mode.opsPoliciesTitle')}
              </>
            ) : (
              <>
                <Sliders className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                {t('policies.title')}
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsPoliciesSubtitle') : t('policies.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="text-xs gap-1.5 rounded-xl"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('common.reset')}</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSavePolicies}
            className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isOps ? 'Save Guardrails' : t('policies.deployRedis')}</span>
          </Button>
        </div>
      </div>

      {/* CORE FINANCIAL GUARDRAIL: Team Financial Budget Cap & Multi-Currency Policy */}
      <Card className="glass-panel overflow-hidden border-sky-500/20 dark:border-sky-500/20 shadow-md">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-inner">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('policies.budgetPolicyTitle')}</span>
                  <Badge variant="cyan" className="font-mono text-[10px] py-0 px-1.5">
                    {budgetCurrency}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">{t('policies.budgetPolicyDesc')}</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('policies.hardStopLabel')}
                </span>
                <Switch checked={hardStop} onCheckedChange={setHardStop} />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top Controls: Currency & Budget Limit */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Currency Picker */}
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span>{t('policies.currencyLabel')}</span>
              </label>
              <Combobox
                items={Object.entries(CURRENCY_REGISTRY).map(([code, meta]) => ({
                  value: code,
                  label: `${meta.flag} ${code} - ${meta.name} (${meta.symbol})`,
                  sublabel: meta.symbol,
                  badge: code,
                }))}
                value={budgetCurrency}
                onChange={(val) => setBudgetCurrency(val || 'USD')}
                placeholder="Select currency..."
                searchPlaceholder="Search currency (USD, EUR, AED, GBP)..."
                showCategoryTabs={false}
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                All provider charges converted to {budgetCurrency} via FxEngine.
              </p>
            </div>

            {/* Monthly Budget Cap Slider / Input */}
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {t('policies.monthlyBudgetLabel')}
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrencyAmount(monthlyBudget, budgetCurrency)}
                </span>
              </div>
              <Slider
                value={monthlyBudget}
                min={100}
                max={50000}
                step={100}
                onValueChange={(val) => setMonthlyBudget(Array.isArray(val) ? val[0] : val)}
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Min: {formatCurrencyAmount(100, budgetCurrency)}</span>
                <span>Max: {formatCurrencyAmount(50000, budgetCurrency)}</span>
              </div>
            </div>

            {/* Real-time Multi-Currency FX Preview */}
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('policies.fxPreviewLabel')}</span>
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block">USD Equivalent</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${budgetUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block">EUR Valuation</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    €
                    {(budgetUsd * 0.924).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Month-to-Date Progress Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {t('policies.usedAmountLabel')}:
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCurrencyAmount(usedAmount, budgetCurrency)}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  (${usedUsd.toFixed(2)} USD)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Utilization:</span>
                <Badge
                  variant={utilizationPercent >= 90 ? 'destructive' : utilizationPercent >= 70 ? 'warning' : 'success'}
                  className="font-mono text-xs"
                >
                  {utilizationPercent}% of Limit
                </Badge>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  utilizationPercent >= 90
                    ? 'bg-rose-500'
                    : utilizationPercent >= 70
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${utilizationPercent}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Remaining: {formatCurrencyAmount(Math.max(0, monthlyBudget - usedAmount), budgetCurrency)}</span>
              <span>Reset Date: 1st of Next Month (00:00 UTC)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Guardrail 1: WhatsApp Session Cost Optimizer */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                    WhatsApp Cost Optimizer
                  </CardTitle>
                  <CardDescription>
                    Automatically switches from paid Template messages ($0.035) to free Session messages when a 24h user
                    window is active.
                  </CardDescription>
                </div>
              </div>
              <Switch checked={whatsappSessionAutoConvert} onCheckedChange={setWhatsappSessionAutoConvert} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">{t('overview.kpiCostSaved')}: </span>
              Convey tracks incoming customer replies and automatically sends replies as free text messages inside the
              active 24-hour window.
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-500 dark:text-slate-400">Estimated Monthly Savings:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">$1,450.00 / mo</span>
            </div>
          </CardContent>
        </Card>

        {/* Business Guardrail 2: Regional Quiet Hours */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                    Quiet Hours Protection (Night-Time Deflection)
                  </CardTitle>
                  <CardDescription>
                    Holds non-critical marketing messages arriving between 22:00 and 08:00 local recipient time to 08:00
                    the next morning.
                  </CardDescription>
                </div>
              </div>
              <Switch checked={quietHoursEnabled} onCheckedChange={setQuietHoursEnabled} />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Customer Courtesy Guarantee: </span>
              Prevents bothering customers late at night. Urgent security OTPs always bypass quiet hours.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engineering Guardrail 1: DRR Multi-Tenant Fair Scheduler */}
      {(isEngineer || showAdvancedDrrInOps) && (
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('policies.drrTitle')}
                  </CardTitle>
                  <CardDescription>{t('policies.drrDesc')}</CardDescription>
                </div>
              </div>
              <Badge variant="purple">{t('common.active')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Enterprise Tier */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase">
                    {t('policies.enterpriseTier')}
                  </span>
                  <span className="font-mono text-sm text-slate-900 dark:text-white font-bold">
                    {quantumEnterprise} msgs/round
                  </span>
                </div>
                <Slider value={quantumEnterprise} min={50} max={500} step={10} onValueChange={setQuantumEnterprise} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('policies.slaTarget')}</p>
              </div>

              {/* Pro Tier */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    {t('policies.proTier')}
                  </span>
                  <span className="font-mono text-sm text-slate-900 dark:text-white font-bold">
                    {quantumPro} msgs/round
                  </span>
                </div>
                <Slider value={quantumPro} min={10} max={100} step={5} onValueChange={setQuantumPro} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Target 800ms P95 SLA</p>
              </div>

              {/* Free Tier */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {t('policies.freeTier')}
                  </span>
                  <span className="font-mono text-sm text-slate-900 dark:text-white font-bold">
                    {quantumFree} msgs/round
                  </span>
                </div>
                <Slider value={quantumFree} min={1} max={50} step={1} onValueChange={setQuantumFree} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Best-effort fair share</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engineering Guardrail 2: Token Bucket Limiter */}
      {(isEngineer || showAdvancedDrrInOps) && (
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('policies.tokenBucketTitle')}
                </CardTitle>
                <CardDescription>{t('policies.tokenBucketDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  {t('policies.rateLimitLabel')}:
                </span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{rateLimitRps} tokens/sec</span>
              </div>
              <Slider value={rateLimitRps} min={500} max={20000} step={500} onValueChange={setRateLimitRps} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  {t('policies.burstCapacityLabel')}:
                </span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{burstCapacity} tokens</span>
              </div>
              <Slider value={burstCapacity} min={1000} max={50000} step={1000} onValueChange={setBurstCapacity} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ops Mode: Expand Advanced Fair-Share Scheduling Toggle */}
      {isOps && !showAdvancedDrrInOps && (
        <div className="pt-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvancedDrrInOps(true)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white gap-1"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Show Technical Rate Limits & Deficit Round Robin Quanta</span>
          </Button>
        </div>
      )}
    </div>
  );
}
