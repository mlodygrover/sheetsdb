import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  lawFirm: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().or(z.literal("")),
  country: z.string().min(1),
  groups: z.array(z.string().min(1)).min(1),
});

export const modifyUserSchema = createUserSchema.extend({
  key: z.string().min(6),
});
