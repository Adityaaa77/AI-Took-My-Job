import mongoose, { Schema, Document } from "mongoose";
import { getNextId } from "./Counter.model.js";

export type HospitalTier = "Tier-1" | "Tier-2" | "Tier-3";

export interface IHospital extends Document {
  hospital_id: string;
  name: string;
  tier: HospitalTier;
  location_zone: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

const HospitalSchema = new Schema<IHospital>(
  {
    hospital_id: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    tier: {
      type: String,
      enum: ["Tier-1", "Tier-2", "Tier-3"],
      required: true,
    },
    location_zone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contact_person: { type: String, trim: true },
    contact_phone: { type: String, trim: true },
    contact_email: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

HospitalSchema.pre("validate", async function () {
  if (!this.hospital_id) {
    this.hospital_id = await getNextId("hospital", "HOSP");
  }
});

export const Hospital = mongoose.model<IHospital>("Hospital", HospitalSchema);