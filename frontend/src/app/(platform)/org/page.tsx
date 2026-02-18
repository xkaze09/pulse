import { OrgCanvas } from "@/components/canvas/OrgCanvas";

export default function OrgPage() {
  return (
    <div className="h-full">
      <OrgCanvas diagramType="org_chart" />
    </div>
  );
}
