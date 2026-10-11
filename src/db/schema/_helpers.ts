import { integer, text } from "drizzle-orm/sqlite-core";
import { uuidv7 } from "@/lib/id";

export const pk = () => text("id").primaryKey().$defaultFn(uuidv7);
export const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
export const createdAt = () => ts("created_at").notNull().$defaultFn(() => new Date());
export const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());
export const deletedAt = () => ts("deleted_at");
export const bool = (name: string) => integer(name, { mode: "boolean" });
