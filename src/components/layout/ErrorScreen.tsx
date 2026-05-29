interface Props {
  status: number;
  message: string;
  onRetry: () => void;
  onUseSample: () => void;
}

export default function ErrorScreen({ status, message, onRetry, onUseSample }: Props) {
  return (
    <div className="error-screen">
      <div className="error-icon">🔒</div>
      <h2>{status === 403 ? 'API Access Not Enabled' : 'Connection Error'}</h2>
      <p>{message}</p>

      {status === 403 && (
        <ol className="steps">
          <li>Open your AppSheet app editor</li>
          <li>Go to <strong>Settings → Integrations</strong></li>
          <li>Under <strong>IN: from cloud services</strong>, enable the API</li>
          <li>For each table, go to <strong>Security → Allow API access</strong></li>
          <li>Set tables to <strong>Read Only</strong> (minimum)</li>
          <li>Click <strong>Try Again</strong> below</li>
        </ol>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={onRetry}>🔄 Try Again</button>
        <button className="btn btn-secondary" onClick={onUseSample}>📋 Use Sample Data</button>
      </div>
    </div>
  );
}
