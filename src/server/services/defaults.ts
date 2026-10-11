import { db } from "@/db/driver";
import { mealSlots, profiles, userSettings } from "@/db/schema";

export const DEFAULT_MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

/** Runs once when an account is created: profile, settings, and the default meal slots, in one batch. */
export async function createUserDefaults(user: { id: string; name: string }) {
  await db.batch([
    db.insert(profiles).values({ userId: user.id, displayName: user.name }).onConflictDoNothing(),
    db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing(),
    ...DEFAULT_MEAL_SLOTS.map((name, position) => db.insert(mealSlots).values({ userId: user.id, name, position })),
  ]);
}
