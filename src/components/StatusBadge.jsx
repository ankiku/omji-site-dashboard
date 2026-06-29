import { statusClass } from '../utils/helpers';

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${statusClass(status)}`}>
      {status}
    </span>
  );
}
