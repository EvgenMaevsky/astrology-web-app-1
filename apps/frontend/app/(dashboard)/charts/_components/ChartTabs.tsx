"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Person } from "@/app/actions/persons";
import { ChartForm } from "./ChartForm";
import { TransitForm } from "./TransitForm";
import { SolarReturnForm } from "./SolarReturnForm";
import { SynastryForm } from "./SynastryForm";
import { SavedChartsTab } from "./SavedChartsTab";

const TAB_IDS = ["natal", "transit", "solar-return", "synastry", "saved"] as const;

type TabId = (typeof TAB_IDS)[number];

const TAB_LABEL_KEYS: Record<TabId, string> = {
  natal: "natal",
  transit: "transit",
  "solar-return": "solarReturn",
  synastry: "synastry",
  saved: "saved",
};

interface Props {
  persons: Person[];
  selectedPerson?: Person | null;
}

export function ChartTabs({ persons, selectedPerson }: Props) {
  const [active, setActive] = useState<TabId>("natal");
  const t = useTranslations("charts.tabs");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active === id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t(TAB_LABEL_KEYS[id])}
          </button>
        ))}
      </div>

      {active === "natal" && (
        <ChartForm persons={persons} selectedPerson={selectedPerson} />
      )}
      {active === "transit" && <TransitForm persons={persons} />}
      {active === "solar-return" && <SolarReturnForm persons={persons} />}
      {active === "synastry" && <SynastryForm persons={persons} />}
      {active === "saved" && <SavedChartsTab />}
    </div>
  );
}
