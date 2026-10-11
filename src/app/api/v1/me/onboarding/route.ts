import { route } from "@/server/http";
import { completeOnboarding, onboardingInput } from "@/server/services/profile";

export const POST = route({ body: onboardingInput }, ({ viewer, body }) => completeOnboarding(viewer.id, body));
