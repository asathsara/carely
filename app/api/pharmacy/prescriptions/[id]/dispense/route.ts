import { NextResponse } from "next/server";
import { dispensePrescriptionSchema } from "@/lib/schemas/pharmacy";
import { dispensePrescription } from "@/lib/services/dispensing";
import { pharmacyError, pharmacyHeaders, requirePharmacist } from "../../../_shared";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePharmacist(request, true);
    const { id } = await params;
    dispensePrescriptionSchema.parse(await request.json());
    await dispensePrescription(id, actor);
    return NextResponse.json({ status: "dispensed" }, { headers: pharmacyHeaders });
  } catch (error) {
    return pharmacyError(error);
  }
}
