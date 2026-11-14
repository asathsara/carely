import { redirect } from "next/navigation";

export default async function NursePreliminaryRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const id = typeof query.encounterId === "string" ? query.encounterId : "";
  redirect(
    `/nurse/vitals${id ? `?encounterId=${encodeURIComponent(id)}` : ""}#preliminary`
  );
}
