import { CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/orders/info-tooltip";

export function ChartCardHeader({
  title,
  showRevenueInfo,
  infoTitle,
  infoContent,
}: {
  title: string;
  showRevenueInfo?: boolean;
  infoTitle?: string;
  infoContent?: React.ReactNode;
}) {
  const show = showRevenueInfo && infoContent;

  return (
    <CardHeader className="relative pb-2">
      <CardTitle>{title}</CardTitle>
      {show ? (
        <InfoTooltip className="absolute right-4 top-4">{infoContent}</InfoTooltip>
      ) : null}
    </CardHeader>
  );
}
