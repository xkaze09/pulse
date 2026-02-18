import { OrgCanvas } from "@/components/canvas/OrgCanvas";

export default function ProcessesPage() {
  return (
    <div className="h-full">
      <OrgCanvas diagramType="business_process" />
    </div>
  );
}
