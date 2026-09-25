import './setup';
import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import type { BudgetPolicyDto } from '@convey/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { api } from '../src/lib/api';
import { PoliciesPage } from '../src/pages/PoliciesPage';

const loaded: BudgetPolicyDto = {
  id: 'policy',
  teamId: 'alpha',
  currency: 'EUR',
  monthlyBudget: 100,
  usedAmount: 20,
  reservedAmount: 5,
  remainingAmount: 75,
  hardStop: true,
  currencySymbol: '€',
  updatedAt: new Date().toISOString(),
};
const get = spyOn(api, 'getBudget');
const save = spyOn(api, 'saveBudget');
afterAll(() => {
  get.mockRestore();
  save.mockRestore();
});
afterEach(() => {
  get.mockReset();
  save.mockReset();
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PoliciesPage />
    </QueryClientProvider>,
  );
}
it('loads real team usage and persists the edited budget', async () => {
  get.mockResolvedValue(loaded);
  save.mockResolvedValue({ ...loaded, monthlyBudget: 200 });
  const view = mount();
  expect(view.getByText('Save Budget').closest('button')?.disabled).toBe(true);
  fireEvent.change(view.getByLabelText('Budget team ID'), { target: { value: 'alpha' } });
  await waitFor(() => expect((view.getByLabelText('Monthly budget') as HTMLInputElement).value).toBe('100'));
  expect(view.container.textContent).toContain('€20.00');
  expect(view.container.textContent).toContain('€5.00');
  fireEvent.change(view.getByLabelText('Monthly budget'), { target: { value: '200' } });
  fireEvent.click(view.getByText('Save Budget'));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith('alpha', { monthlyBudget: 200, currency: 'EUR', hardStop: true }),
  );
});
it('shows load errors and prevents saving fabricated defaults', async () => {
  get.mockRejectedValue(new Error('offline'));
  const view = mount();
  fireEvent.change(view.getByLabelText('Budget team ID'), { target: { value: 'alpha' } });
  await waitFor(() => expect(view.getByRole('alert').textContent).toContain('could not be loaded'));
  expect(view.getByText('Save Budget').closest('button')?.disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
