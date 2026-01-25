import { redirect } from "next/navigation";

/**
 * Root route intentionally redirects to the Dashboard.
 * This keeps the demo focused on the admin experience (charts + events table)
 * rather than maintaining a separate marketing-style home page.
 */
export default function HomePage() {
  redirect("/dashboard");
}