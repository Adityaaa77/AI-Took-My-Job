import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document {
  entity: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  entity: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>("Counter", CounterSchema);

/**
 * Atomically increments the counter for `entity` and returns
 * a zero-padded human-readable ID like "DRUG-001".
 */
export async function getNextId(
  entity: string,
  prefix: string
): Promise<string> {
  const result = await Counter.findOneAndUpdate(
    { entity },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${String(result!.seq).padStart(3, "0")}`;
}
