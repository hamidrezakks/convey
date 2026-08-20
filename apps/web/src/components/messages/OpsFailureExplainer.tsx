import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/button';

export interface OpsFailureExplainerProps {
  status?: string;
  errorMessage?: string;
  recipient?: string;
  onUnblock?: () => void;
  onRetry?: () => void;
}

export function OpsFailureExplainer({ errorMessage = '', onUnblock, onRetry }: OpsFailureExplainerProps) {
  const { t } = useI18n();

  const getExplanation = () => {
    const lower = errorMessage.toLowerCase();

    if (lower.includes('spam') || lower.includes('complaint')) {
      return {
        title: 'Customer Marked as Spam',
        description:
          'The customer previously flagged an email from this domain as spam. Convey automatically stopped sending to protect your domain reputation.',
        actionLabel: 'Unblock Customer (If Confirmed)',
        actionType: 'unblock',
        badge: 'Spam Protection',
      };
    }

    if (lower.includes('bounce') || lower.includes('does not exist') || lower.includes('mailbox')) {
      return {
        title: 'Email Address Does Not Exist (Hard Bounce)',
        description:
          'The receiving email server reported that this mailbox does not exist. Verify the spelling of the email address with the customer.',
        actionLabel: 'Edit & Retry',
        actionType: 'retry',
        badge: 'Invalid Address',
      };
    }

    if (lower.includes('unsub') || lower.includes('opt-out')) {
      return {
        title: 'Customer Unsubscribed',
        description:
          'The recipient clicked unsubscribe on a previous message. Convey strictly respects recipient preferences to maintain legal compliance.',
        actionLabel: 'Customer Opt-In Required',
        actionType: 'none',
        badge: 'Opt-Out Enforced',
      };
    }

    if (lower.includes('timeout') || lower.includes('circuit') || lower.includes('network')) {
      return {
        title: 'Temporary Provider Glitch',
        description:
          'The downstream delivery provider experienced a brief network timeout. Convey automatically retried via backup channels.',
        actionLabel: 'Safe Retry Now',
        actionType: 'retry',
        badge: 'Transient Issue',
      };
    }

    return {
      title: 'Delivery Could Not Be Completed',
      description:
        errorMessage ||
        'The downstream communication channel reported an issue while attempting to deliver this message.',
      actionLabel: 'Retry Delivery',
      actionType: 'retry',
      badge: 'Delivery Issue',
    };
  };

  const exp = getExplanation();

  return (
    <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-xs font-bold text-slate-900 dark:text-white">{exp.title}</h5>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
              {exp.badge}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{exp.description}</p>
        </div>
      </div>

      {(onUnblock || onRetry) && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
          {onUnblock && exp.actionType === 'unblock' && (
            <Button variant="outline" size="sm" onClick={onUnblock} className="text-xs gap-1.5 h-8">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('mode.unblockContact')}</span>
            </Button>
          )}
          {onRetry && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRetry}
              className="text-xs gap-1.5 h-8 font-semibold rounded-xl shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('mode.safeRetry')}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
