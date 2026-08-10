import { notFound } from "next/navigation";
import { isServiceType, extrasEnabled } from "@/lib/extras";
import { SongFlow } from "../SongFlow";
import { CardFlow } from "../CardFlow";
import { BundleFlow } from "../BundleFlow";

// Each paid extra is a dark, multi-step creation wizard.
export default function OrderBriefPage({ params }: { params: { service: string } }) {
  if (!extrasEnabled()) return notFound();
  if (!isServiceType(params.service)) return notFound();

  if (params.service === "song") return <SongFlow />;
  if (params.service === "card") return <CardFlow />;
  return <BundleFlow />; // "bundle"
}
