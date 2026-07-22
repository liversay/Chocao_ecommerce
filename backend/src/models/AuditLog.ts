import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IAuditLog {
  // Sin actor = acción del sistema (source "job")
  actor?: Types.ObjectId;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  source: "api" | "mcp" | "job";
  createdAt: Date;
}

export type AuditLogDoc = HydratedDocument<IAuditLog>;

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorEmail: { type: String },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    requestId: { type: String },
    source: { type: String, enum: ["api", "mcp", "job"], required: true, default: "api" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

// Registro de solo-anexado: cualquier intento de modificar o borrar una
// entrada falla. La auditoría solo crece.
const IMMUTABLE_MESSAGE = "El registro de auditoría es inmutable (solo-anexado)";
for (const op of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const) {
  auditLogSchema.pre(op, function () {
    throw new Error(IMMUTABLE_MESSAGE);
  });
}
auditLogSchema.pre("save", function () {
  if (!this.isNew) throw new Error(IMMUTABLE_MESSAGE);
});

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
