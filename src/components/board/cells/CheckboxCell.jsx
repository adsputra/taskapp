import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";

export default function CheckboxCell({ value, onUpdate }) {
  const isChecked = !!value;

  const handleChange = (checked) => {
    if (onUpdate) onUpdate(checked);
  };

  return (
    <div className="flex items-center justify-center h-full w-full">
      <Checkbox
        checked={isChecked}
        onCheckedChange={handleChange}
        disabled={!onUpdate}
        aria-label="Checkbox"
      />
    </div>
  );
}
