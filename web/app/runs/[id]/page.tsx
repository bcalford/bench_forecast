import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RunView from "@/components/RunView";
import { loadForecast } from "@/lib/views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await loadForecast((await params).id);
  return { title: f ? `${f.title} · Bench Forecast` : "Bench Forecast" };
}

export default async function RunPage({ params }: Props) {
  const f = await loadForecast((await params).id);
  if (!f) notFound();
  return <RunView f={f} />;
}
