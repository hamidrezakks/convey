/** These legacy placeholders must not be advertised as usable native integrations. */
export const INCOMPLETE_NATIVE_PROVIDERS = [
  'afro-sms',
  'burst-sms',
  'clickatell',
  'cm-telecom',
  'eazy-sms',
  'gupshup',
  'imedia',
  'isend-sms',
  'isendpro-sms',
  'kannel',
  'maqsam',
  'mobishastra',
  'ring-central',
  'ruach-sms',
  'sendchamp',
  'simpletexting',
  'sms-central',
  'smsmode',
  'termii',
  'unifonic',
] as const;
export function isNativeProviderIncomplete(providerId: string): boolean {
  return (INCOMPLETE_NATIVE_PROVIDERS as readonly string[]).includes(providerId);
}
