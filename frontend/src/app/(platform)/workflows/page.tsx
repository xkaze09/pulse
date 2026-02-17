import { OrgCanvas } from "@/components/canvas/OrgCanvas";

export default function WorkflowsPage() {
  return (
    <div className="h-full">
      <OrgCanvas diagramType="workflow" />
    </div>
  );
}
