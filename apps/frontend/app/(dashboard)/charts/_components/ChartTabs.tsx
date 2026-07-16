"use client";

import { useState } from "react";
import { Person } from "@/app/actions/persons";
import { ChartForm } from "./ChartForm";
import { TransitForm } from "./TransitForm";
import { SolarReturnForm } from "./SolarReturnForm";
import { SynastryForm } from "./SynastryForm";
import { SavedChartsTab } from "./SavedChartsTab";

const TABS = [
  { id: "natal", label: "Natal" },
  { id: "transit", label: "Transit" },
  { id: "solar-return", label: "Solar Return" },
  { id: "synastry", label: "Synastry" },
  { id: "saved", label: "Saved" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  persons: Person[];
  selectedPerson?: Person | null;
}

export function ChartTabs({ persons, selectedPerson }: Props) {
  const [active, setActive] = useState<TabId>("natal");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label}
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
