import { Calculator } from "lucide-react";
import { LabelCalculatorAdmin } from "@/components/admin/LabelCalculatorAdmin";

export default function AdminLabelCalculator() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Calculator size={23} className="text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Smart Print Calculator</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">Manage sheet types, margins, gaps, product shapes, print options and customer prices.</p>
      </div>
      <LabelCalculatorAdmin />
    </div>
  );
}
