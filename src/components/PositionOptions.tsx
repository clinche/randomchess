"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

export interface PositionOptionsSettings {
  maxEvaluation: number; // Centipawns
  stockfishDepth: number;
  fairnessChecks: {
    kingsNotInCheck: boolean;
    bishopsOnDifferentColors: boolean;
    noStalemate: boolean;
    evaluationWithinRange: boolean;
  };
}

interface PositionOptionsProps {
  initialOptions: PositionOptionsSettings;
  onOptionsChange: (options: PositionOptionsSettings) => void;
  isOpen?: boolean;
}

export function PositionOptions({
  initialOptions,
  onOptionsChange,
  isOpen = false,
}: PositionOptionsProps) {
  const [options, setOptions] = useState<PositionOptionsSettings>(initialOptions);
  const [showOptions, setShowOptions] = useState<boolean>(isOpen);

  // Handle slider changes
  const handleSliderChange = (
    key: keyof Pick<PositionOptionsSettings, "maxEvaluation" | "stockfishDepth">,
    value: number[]
  ) => {
    const newOptions = { ...options, [key]: value[0] };
    setOptions(newOptions);
    onOptionsChange(newOptions);
  };

  // Handle fairness check toggle
  const handleCheckboxChange = (key: keyof PositionOptionsSettings["fairnessChecks"], checked: boolean) => {
    const newOptions = {
      ...options,
      fairnessChecks: {
        ...options.fairnessChecks,
        [key]: checked,
      },
    };
    setOptions(newOptions);
    onOptionsChange(newOptions);
  };

  // Format evaluation as pawns
  const formatEvaluation = (value: number) => {
    return `±${(value / 100).toFixed(2)} pawns`;
  };

  if (!showOptions) {
    return (
      <Button 
        variant="outline" 
        className="w-full mt-2"
        onClick={() => setShowOptions(true)}
      >
        Show Position Generation Options
      </Button>
    );
  }

  return (
    <Card className="p-4 mt-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">Position Generation Options</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowOptions(false)}
        >
          Hide
        </Button>
      </div>
      
      <Separator className="my-3" />
      
      <div className="space-y-6">
        {/* Max Evaluation Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="maxEvaluation" className="text-sm">Max Evaluation</Label>
            <span className="text-xs">{formatEvaluation(options.maxEvaluation)}</span>
          </div>
          <Slider
            id="maxEvaluation"
            min={50}
            max={300}
            step={25}
            value={[options.maxEvaluation]}
            onValueChange={(value) => handleSliderChange("maxEvaluation", value)}
          />
          <p className="text-xs text-muted-foreground">
            Maximum difference in evaluation between sides for a position to be considered "fair"
          </p>
        </div>
        
        {/* Stockfish Depth Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="stockfishDepth" className="text-sm">Stockfish Depth</Label>
            <span className="text-xs">{options.stockfishDepth}</span>
          </div>
          <Slider
            id="stockfishDepth"
            min={10}
            max={20}
            step={1}
            value={[options.stockfishDepth]}
            onValueChange={(value) => handleSliderChange("stockfishDepth", value)}
          />
          <p className="text-xs text-muted-foreground">
            Analysis depth (higher = more accurate but slower)
          </p>
        </div>

        <Separator className="my-2" />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Fairness Checks</h4>
          
          {/* Kings Not In Check */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="kingsNotInCheck" 
              checked={options.fairnessChecks.kingsNotInCheck}
              onCheckedChange={(checked) => 
                handleCheckboxChange("kingsNotInCheck", checked as boolean)
              }
            />
            <Label htmlFor="kingsNotInCheck" className="text-sm">Kings not in check</Label>
          </div>
          
          {/* Bishops on Different Colors */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="bishopsOnDifferentColors" 
              checked={options.fairnessChecks.bishopsOnDifferentColors}
              onCheckedChange={(checked) => 
                handleCheckboxChange("bishopsOnDifferentColors", checked as boolean)
              }
            />
            <Label htmlFor="bishopsOnDifferentColors" className="text-sm">Bishops on different color squares</Label>
          </div>
          
          {/* No Stalemate */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="noStalemate" 
              checked={options.fairnessChecks.noStalemate}
              onCheckedChange={(checked) => 
                handleCheckboxChange("noStalemate", checked as boolean)
              }
            />
            <Label htmlFor="noStalemate" className="text-sm">No stalemate (both sides can move)</Label>
          </div>
          
          {/* Evaluation Within Range */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="evaluationWithinRange" 
              checked={options.fairnessChecks.evaluationWithinRange}
              onCheckedChange={(checked) => 
                handleCheckboxChange("evaluationWithinRange", checked as boolean)
              }
            />
            <Label htmlFor="evaluationWithinRange" className="text-sm">Evaluation within range</Label>
          </div>
        </div>
      </div>
    </Card>
  );
}