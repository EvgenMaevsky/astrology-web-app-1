import { useMessages } from "next-intl";
import { getMessages } from "next-intl/server";

type FeatureDict = Record<string, string>;

function lookup(dict: FeatureDict | undefined, raw: string): string {
  return dict?.[raw] ?? raw;
}

export function useFeatureTranslator() {
  const messages = useMessages() as { billing?: { features?: FeatureDict } } | undefined;
  const dict = messages?.billing?.features;
  return (raw: string): string => lookup(dict, raw);
}

export async function getFeatureTranslator() {
  const messages = (await getMessages()) as { billing?: { features?: FeatureDict } };
  const dict = messages?.billing?.features;
  return (raw: string): string => lookup(dict, raw);
}
