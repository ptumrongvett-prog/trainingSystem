import Papa from 'papaparse';

interface Props {
  data: Record<string, unknown>[];
  filename: string;
  label?: string;
}

export default function ExportButton({ data, filename, label = 'Export CSV' }: Props) {
  const handleExport = () => {
    if (data.length === 0) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="btn btn-secondary" onClick={handleExport} disabled={data.length === 0}>
      📥 {label}
    </button>
  );
}
