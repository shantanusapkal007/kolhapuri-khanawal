/**
 * Kolhapuri Khanawal Restaurant Operating System
 * Phase 2: Recipe Engine & Theoretical Portion Availability
 */

import { Recipe, RecipeComponent, Ingredient } from "@/types/inventory";
import { normalizeToBaseUnit } from "./unit-converter";

export interface RecipePortionCalculation {
  recipeId: string;
  menuItemId: string;
  menuItemName: string;
  theoreticalPortionsRemaining: number;
  bottleneckIngredient?: {
    ingredientId: string;
    ingredientName: string;
    availableStock: number;
    requiredPerPortion: number;
    unit: string;
  };
  recipeCost: number;
  sellingPrice: number;
  foodCostPercentage: number;
  grossMarginPercentage: number;
}

/**
 * Calculates how many full portions of a recipe can be made based on current available ingredient stock
 */
export function calculateRecipeAvailability(
  recipe: Recipe,
  ingredientsMap: Map<string, Ingredient>,
  sellingPrice: number
): RecipePortionCalculation {
  let minPortions = Infinity;
  let bottleneck: RecipePortionCalculation["bottleneckIngredient"] = undefined;
  let totalRecipeCost = 0;

  for (const comp of recipe.components) {
    if (comp.componentType === "RAW_INGREDIENT" && comp.ingredientId) {
      const ing = ingredientsMap.get(comp.ingredientId);
      if (!ing) continue;

      // Available stock = physical - reserved (rounded to 4 decimals)
      const availableStock = Number(
        Math.max(0, ing.physicalStock - ing.reservedStock).toFixed(4)
      );

      // Convert recipe component quantity to ingredient base unit
      const requiredPerPortion = Number(
        normalizeToBaseUnit(
          comp.quantity * (comp.yieldFactor || 1.0),
          comp.unit,
          ing.baseUnit
        ).toFixed(4)
      );

      const componentCost = requiredPerPortion * ing.weightedAvgCostPerUnit;
      totalRecipeCost += componentCost;

      if (!comp.isOptional && requiredPerPortion > 0) {
        // Safe decimal floor division
        const ratio = Number((availableStock / requiredPerPortion).toFixed(6));
        const possiblePortions = Math.floor(ratio);

        if (possiblePortions < minPortions) {
          minPortions = possiblePortions;
          bottleneck = {
            ingredientId: ing.id,
            ingredientName: ing.name,
            availableStock,
            requiredPerPortion,
            unit: ing.baseUnit,
          };
        }
      }
    }
  }

  const finalPortions = minPortions === Infinity ? 0 : Math.max(0, minPortions);
  const roundedCost = Number(totalRecipeCost.toFixed(2));
  const foodCostPercentage =
    sellingPrice > 0 ? Number(((roundedCost / sellingPrice) * 100).toFixed(2)) : 0;
  const grossMarginPercentage =
    sellingPrice > 0
      ? Number((((sellingPrice - roundedCost) / sellingPrice) * 100).toFixed(2))
      : 0;

  return {
    recipeId: recipe.id,
    menuItemId: recipe.menuItemId,
    menuItemName: recipe.menuItemName || "Item",
    theoreticalPortionsRemaining: finalPortions,
    bottleneckIngredient: bottleneck,
    recipeCost: roundedCost,
    sellingPrice,
    foodCostPercentage,
    grossMarginPercentage,
  };
}
