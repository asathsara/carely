import { Badge } from "@/components/ui/badge";
import type { MedicineStockView } from "@/lib/schemas/pharmacy";

export function StockBadge({ medicine }: { medicine: MedicineStockView }) {
  const available = medicine.isActive && medicine.quantityOnHand > 0;
  return (
    <Badge
      className={
        available
          ? "bg-carely-success-soft text-carely-success"
          : "bg-red-50 text-red-700"
      }
    >
      {!medicine.isActive ? "Inactive" : available ? "In stock" : "Out of stock"}
    </Badge>
  );
}
