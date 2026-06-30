import { z } from "zod";

const VALID_CONDITION_KEYS = [
  "finalidade",
  "tipoAtendimento",
  "sucesso",
  "cidade",
  "condominio",
  "dropUsado",
  "faixaDrop",
  "conectoresUsados",
  "garantia",
  "subterraneaAereo",
  "valorRecebidoUnetvale",
] as const;

const conditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
  z.object({ min: z.number().optional(), max: z.number().optional() }),
]);

export const lpuConditionsSchema = z
  .record(z.enum(VALID_CONDITION_KEYS), conditionValueSchema)
  .refine(
    (c) => Object.keys(c).length > 0,
    "Pelo menos uma condição é obrigatória",
  );

const payoutFixedSchema = z.object({
  type: z.literal("fixed"),
  value: z.number().nonnegative(),
});

const payoutFormulaSchema = z.object({
  type: z.literal("formula"),
  base: z.number().nonnegative(),
  additional: z.object({
    field: z.enum(["dropUsado", "conectoresUsados", "valorRecebidoUnetvale"]),
    ratePerUnit: z.number().positive(),
  }),
});

const payoutPercentageSchema = z.object({
  type: z.literal("percentage_of_revenue"),
  percentage: z.number().positive().max(100),
});

export const lpuPayoutSchema = z.discriminatedUnion("type", [
  payoutFixedSchema,
  payoutFormulaSchema,
  payoutPercentageSchema,
]);

export const createLpuRuleSchema = z.object({
  conditions: lpuConditionsSchema,
  payout: lpuPayoutSchema,
  description: z.string().min(3).max(200),
  prioridade: z.number().int().positive().optional(),
});

export function calcPrioridade(conditions: Record<string, unknown>): number {
  return Object.keys(conditions).length * 100;
}
