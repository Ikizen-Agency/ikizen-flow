import { Badge } from "@/shared/ui/badge";
import { ORDER_STATUS_LABELS, orderStatusTone, type EffectiveOrderStatus } from "../../domain/order";

export const ORDER_STATUS_ICONS: Record<EffectiveOrderStatus, string> = {
  draft: "edit_note",
  pending: "schedule",
  processing: "autorenew",
  invoiced: "mark_email_read",
  completed: "check_circle",
  cancelled: "block",
  overdue: "error",
};

export function OrderStatusBadge({ status }: { status: EffectiveOrderStatus }) {
  return <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
