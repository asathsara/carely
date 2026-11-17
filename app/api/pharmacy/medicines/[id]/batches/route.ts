import { NextResponse } from "next/server";
import { listStockBatches, receiveStockBatch } from "@/lib/services/stock";
import { pharmacyError, pharmacyHeaders, requirePharmacist } from "../../../_shared";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await requirePharmacist(request);
    const { id } = await params;
    return NextResponse.json(await listStockBatches(id, actor), {
      headers: pharmacyHeaders,
    });
  } catch (error) {
    return pharmacyError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await requirePharmacist(request, true);
    const { id } = await params;
    const batch = await receiveStockBatch(id, await request.json(), actor);
    return NextResponse.json({ batch }, { status: 201, headers: pharmacyHeaders });
  } catch (error) {
    return pharmacyError(error);
  }
}
