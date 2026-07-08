import { NextResponse } from "next/server";
import { deleteCheck, getCheck } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const check = getCheck(Number(id));
  if (!check) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(check);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteCheck(Number(id));
  return new NextResponse(null, { status: 204 });
}
