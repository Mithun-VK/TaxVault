import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PaymentCalendarGrid } from '@/components/shared/PaymentCalendarGrid';

export function Dashboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Calendar</CardTitle>
        <p className="text-sm text-slate-700">
          What falls due on each day, across the year. Click a cell for the bills behind it.
        </p>
      </CardHeader>
      <CardContent>
        <PaymentCalendarGrid />
      </CardContent>
    </Card>
  );
}
