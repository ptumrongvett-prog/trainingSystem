import { ComplianceStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS } from '../../lib/statusRules';

interface Props { status: ComplianceStatus; }

const CSS_CLASS: Record<ComplianceStatus, string> = {
  [ComplianceStatus.COMPLETED]: 'completed',
  [ComplianceStatus.PENDING]: 'pending',
  [ComplianceStatus.OVERDUE]: 'overdue',
  [ComplianceStatus.NOT_ASSIGNED]: 'not-assigned',
  [ComplianceStatus.EXEMPT]: 'exempt',
  [ComplianceStatus.SICK_LEAVE]: 'sick-leave',
  [ComplianceStatus.NOT_SENT]: 'not-sent',
  [ComplianceStatus.INACTIVE]: 'inactive',
};

export default function StatusBadge({ status }: Props) {
  return <span className={`status-badge ${CSS_CLASS[status]}`}>{STATUS_LABELS[status]}</span>;
}
