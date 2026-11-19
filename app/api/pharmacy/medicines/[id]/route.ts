import { NextResponse } from "next/server";
import { updateMedicine } from "@/lib/services/stock";
import { pharmacyError, pharmacyHeaders, requirePharmacist } from "../../_shared";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requirePharmacist(request, true);
    const { id } = await params;
    const medicine = await updateMedicine(id, await request.json(), actor);
    return NextResponse.json({ medicine }, { headers: pharmacyHeaders });
  } catch (error) {
    return pharmacyError(error);
  }
}
