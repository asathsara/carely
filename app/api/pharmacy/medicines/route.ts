import { NextResponse } from "next/server";
import { createMedicine, listMedicines } from "@/lib/services/stock";
import { pharmacyError, pharmacyHeaders, requirePharmacist } from "../_shared";

export async function GET(request: Request) {
  try {
    const actor = await requirePharmacist(request);
    return NextResponse.json(await listMedicines(actor), { headers: pharmacyHeaders });
  } catch (error) {
    return pharmacyError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePharmacist(request, true);
    const medicine = await createMedicine(await request.json(), actor);
    return NextResponse.json({ medicine }, { status: 201, headers: pharmacyHeaders });
  } catch (error) {
    return pharmacyError(error);
  }
}
