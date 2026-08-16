import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole =
  | "admin"
  | "procurement_officer"
  | "warehouse_manager"
  | "hospital_staff"
  | "vendor"
  | "compliance_officer";

export type AssociatedEntityType = "hospital" | "warehouse" | "vendor";

export interface IUser extends Document {
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  associated_entity_id?: string;      // e.g. HOSP-001, WH-001, VEND-001
  associated_entity_type?: AssociatedEntityType;
  is_active: boolean;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password_hash: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "admin",
        "procurement_officer",
        "warehouse_manager",
        "hospital_staff",
        "vendor",
        "compliance_officer",
      ],
      required: true,
    },
    associated_entity_id: { type: String },
    associated_entity_type: {
      type: String,
      enum: ["hospital", "warehouse", "vendor"],
    },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password_hash")) return;
  const salt = await bcrypt.genSalt(10);
  this.password_hash = await bcrypt.hash(this.password_hash, salt);
});

UserSchema.methods.comparePassword = function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password_hash);
};

export const User = mongoose.model<IUser>("User", UserSchema);