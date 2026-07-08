import { z } from "zod";
import { artifactTypeSchema } from "@productos/artifact";

export const projectMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

export const workflowMetadataSchema = z.object({
  currentState: artifactTypeSchema.default("IDEA"),
  completedStates: z.array(artifactTypeSchema).default([]),
});

export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;

export const historyEventSchema = z.object({
  timestamp: z.string().datetime(),
  event: z.string().min(1),
});

export const historyMetadataSchema = z.array(historyEventSchema);

export type HistoryEvent = z.infer<typeof historyEventSchema>;

