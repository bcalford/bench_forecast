import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReasoningView from "@/components/ReasoningView";
import { loadForecast } from "@/lib/views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await loadForecast((await params).id);
  return { title: f ? `The reasoning · ${f.title} · Bench Forecast` : "Bench Forecast" };
}

export default async function ReasoningPage({ params }: Props) {
  const f = await loadForecast((await params).id);
  if (!f) notFound();
  return <ReasoningView f={f} />;
}
