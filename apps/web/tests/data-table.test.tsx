import './setup';
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Sparkles, Trash2 } from 'lucide-react';
import {
  type ColumnDef,
  DataTable,
  DataTableAction,
  DataTableActionGroup,
  DataTableCopyCell,
} from '../src/components/ui/data-table';

interface TestItem {
  id: string;
  name: string;
  count: number;
  status: string;
}

const mockData: TestItem[] = [
  { id: '1', name: 'Alice', count: 42, status: 'active' },
  { id: '2', name: 'Bob', count: 17, status: 'pending' },
  { id: '3', name: 'Charlie', count: 99, status: 'inactive' },
];

describe('Enterprise Reusable DataTable System Suite', () => {
  beforeEach(() => {
    cleanup();
  });

  const columns: ColumnDef<TestItem>[] = [
    {
      id: 'id',
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <span data-testid={`cell-id-${row.id}`}>{row.id}</span>,
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      cell: ({ row }) => <span data-testid={`cell-name-${row.id}`}>{row.name}</span>,
    },
    {
      id: 'count',
      accessorKey: 'count',
      header: 'Count',
      align: 'end',
      enableSorting: true,
      cell: ({ row }) => <span data-testid={`cell-count-${row.id}`}>{row.count}</span>,
    },
  ];

  it('renders all table headers and data rows accurately', () => {
    const { container } = render(<DataTable columns={columns} data={mockData} />);

    expect(container.textContent).toContain('ID');
    expect(container.textContent).toContain('Name');
    expect(container.textContent).toContain('Count');

    expect(container.querySelector('[data-testid="cell-name-1"]')?.textContent).toBe('Alice');
    expect(container.querySelector('[data-testid="cell-name-2"]')?.textContent).toBe('Bob');
    expect(container.querySelector('[data-testid="cell-name-3"]')?.textContent).toBe('Charlie');
  });

  it('respects hidden column definitions (e.g. Ops vs Engineer mode)', () => {
    const columnsWithHidden: ColumnDef<TestItem>[] = [
      ...columns,
      {
        id: 'status',
        header: 'Status',
        hidden: true,
        cell: ({ row }) => <span>{row.status}</span>,
      },
    ];

    const { container } = render(<DataTable columns={columnsWithHidden} data={mockData} />);
    expect(container.textContent).not.toContain('Status');
    expect(container.textContent).not.toContain('active');
  });

  it('handles client-side sorting automatically when clicking sortable header', () => {
    const { container } = render(<DataTable columns={columns} data={mockData} />);

    const countHeader = container.querySelector('th:nth-child(3)');
    expect(countHeader).not.toBeNull();
    if (countHeader) {
      // Click once -> sort ascending by count (17, 42, 99)
      fireEvent.click(countHeader);

      let rows = container.querySelectorAll('tbody tr');
      expect(rows[0].textContent).toContain('Bob'); // 17
      expect(rows[1].textContent).toContain('Alice'); // 42
      expect(rows[2].textContent).toContain('Charlie'); // 99

      // Click again -> sort descending by count (99, 42, 17)
      fireEvent.click(countHeader);
      rows = container.querySelectorAll('tbody tr');
      expect(rows[0].textContent).toContain('Charlie'); // 99
      expect(rows[1].textContent).toContain('Alice'); // 42
      expect(rows[2].textContent).toContain('Bob'); // 17
    }
  });

  it('renders skeleton shimmer rows when isLoading is true with zero layout shift', () => {
    const { container } = render(<DataTable columns={columns} data={mockData} isLoading={true} skeletonRows={4} />);

    const skeletonRows = container.querySelectorAll('tbody tr.animate-pulse');
    expect(skeletonRows.length).toBe(4);
    expect(container.textContent).not.toContain('Alice');
  });

  it('renders rich empty state with title, description and CTA when data is empty', () => {
    const handleAction = mock(() => {});
    const { container } = render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={{
          title: 'No Data Found',
          description: 'Try adjusting your search criteria.',
          action: (
            <button type="button" onClick={handleAction}>
              Clear Filters
            </button>
          ),
        }}
      />,
    );

    expect(container.textContent).toContain('No Data Found');
    expect(container.textContent).toContain('Try adjusting your search criteria.');

    const actionBtn = container.querySelector('button');
    expect(actionBtn).not.toBeNull();
    if (actionBtn) {
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalled();
    }
  });

  it('renders pagination controls and triggers page change callbacks', () => {
    const onPageChange = mock(() => {});
    const { container } = render(
      <DataTable
        columns={columns}
        data={mockData}
        pagination={{
          page: 1,
          pageSize: 2,
          total: 10,
          onPageChange,
        }}
      />,
    );

    expect(container.textContent).toContain('1 - 2');
    expect(container.textContent).toContain('10');

    const nextBtn = container.querySelector('button[title="Next page"]');
    expect(nextBtn).not.toBeNull();
    if (nextBtn) {
      fireEvent.click(nextBtn);
      expect(onPageChange).toHaveBeenCalledWith(2);
    }
  });

  it('triggers onRowClick callback when row is clicked', () => {
    const onRowClick = mock(() => {});
    const { container } = render(<DataTable columns={columns} data={mockData} onRowClick={onRowClick} />);

    const firstRow = container.querySelector('[data-testid="cell-name-1"]')?.closest('tr');
    expect(firstRow).not.toBeNull();
    if (firstRow) {
      fireEvent.click(firstRow);
      expect(onRowClick).toHaveBeenCalledWith(mockData[0], 0);
    }
  });

  it('renders DataTableCopyCell with copy-to-clipboard functionality', () => {
    const writeTextMock = mock(() => Promise.resolve());
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const { container } = render(<DataTableCopyCell value="msg_01JTEST9900" tooltip="Copy Message ID" />);

    expect(container.textContent).toContain('msg_01JTEST9900');
    const copyButton = container.querySelector('button[title="Copy Message ID"]');
    expect(copyButton).not.toBeNull();
    if (copyButton) {
      fireEvent.click(copyButton);
      expect(writeTextMock).toHaveBeenCalledWith('msg_01JTEST9900');
    }
  });

  it('renders standardized DataTableAction and DataTableActionGroup with unified dimensions and click handling', () => {
    const handleClick = mock(() => {});
    const handleDelete = mock(() => {});

    const { container } = render(
      <DataTableActionGroup>
        <DataTableAction
          variant="default"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Test Action"
          onClick={handleClick}
        />
        <DataTableAction
          variant="danger"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          title="Delete Item"
          onClick={handleDelete}
        />
      </DataTableActionGroup>,
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);

    expect(buttons[0].className).toContain('h-7');
    expect(buttons[0].className).toContain('rounded-lg');
    expect(buttons[0].textContent).toContain('Test Action');

    expect(buttons[1].className).toContain('h-7');
    expect(buttons[1].className).toContain('rounded-lg');
    expect(buttons[1].getAttribute('title')).toBe('Delete Item');

    fireEvent.click(buttons[0]);
    expect(handleClick).toHaveBeenCalled();

    fireEvent.click(buttons[1]);
    expect(handleDelete).toHaveBeenCalled();
  });
});
