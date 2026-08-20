import './setup';
import { describe, expect, it } from 'bun:test';
import { render } from '@testing-library/react';
import { Badge } from '../src/components/ui/badge';
import { Button } from '../src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../src/components/ui/card';
import { Input } from '../src/components/ui/input';
import { Slider } from '../src/components/ui/slider';
import { Switch } from '../src/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../src/components/ui/table';

describe('Base UI + Tailwind Primitives Test Suite', () => {
  it('renders Button with variants and loading spinner', () => {
    const { container, rerender } = render(<Button variant="primary">Dispatch Message</Button>);
    expect(container.textContent).toBe('Dispatch Message');
    expect(container.querySelector('button')?.className).toContain('bg-sky-500');

    rerender(
      <Button variant="destructive" isLoading>
        Deleting
      </Button>,
    );
    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
    expect(container.querySelector('button')?.disabled).toBe(true);
  });

  it('renders Badge with status colors and dot indicator', () => {
    const { container } = render(
      <Badge variant="success" dot>
        Delivered
      </Badge>,
    );
    expect(container.textContent).toBe('Delivered');
    expect(container.querySelector('span.animate-pulse')).not.toBeNull();
  });

  it('renders Card hierarchy correctly', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Circuit Breaker</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Closed</p>
        </CardContent>
      </Card>,
    );
    expect(container.querySelector('h3')?.textContent).toBe('Circuit Breaker');
    expect(container.querySelector('p')?.textContent).toBe('Closed');
  });

  it('renders Switch toggle component', () => {
    let checked = false;
    const { container, rerender } = render(
      <Switch
        checked={checked}
        onCheckedChange={(val) => {
          checked = val;
        }}
      />,
    );
    expect(container.querySelector('button')?.getAttribute('aria-checked')).toBe('false');

    rerender(<Switch checked={true} onCheckedChange={() => {}} />);
    expect(container.querySelector('button')?.getAttribute('aria-checked')).toBe('true');
  });

  it('renders Slider input with min, max, step', () => {
    const { container } = render(<Slider value={40} min={0} max={100} step={5} onValueChange={() => {}} />);
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('40');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
  });

  it('renders Input field with custom icon', () => {
    const { container } = render(<Input placeholder="Search messages..." />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Search messages...');
  });

  it('renders Table structure with headers and rows', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>msg_01</TableCell>
            <TableCell>DELIVERED</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelectorAll('th').length).toBe(2);
    expect(container.querySelectorAll('td').length).toBe(2);
    expect(container.textContent).toContain('msg_01');
  });
});
