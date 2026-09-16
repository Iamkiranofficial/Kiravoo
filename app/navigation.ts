export const KIRAVO_ROUTES: Record<string, string> = {
  Studio: "/",
  Create: "/",
  Director: "/#director",
  Projects: "/projects",
  Editor: "/editor",
  History: "/projects?view=history",
  Explore: "/explore",
  Profile: "/creator",
  Settings: "/#settings",
};

export function navigateToWorkspace(item: string): string {
  return KIRAVO_ROUTES[item] || "/";
}
