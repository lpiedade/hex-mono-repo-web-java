import { useNavigation } from "react-router-dom";
import { useRouteTitle } from "@/shared/lib";
import { Shell } from "./Shell";

/**
 * The root route's element: the shell, fed from the router's own state.
 *
 * `Shell` itself stays prop-driven, which keeps it renderable without a data
 * router — that is how its own suites mount it. What only a data router knows —
 * the matched routes' titles, whether a lazily loaded screen is still on its
 * way — is read here and handed down.
 */
export function ShellLayout() {
  const navigation = useNavigation();
  useRouteTitle();

  return <Shell pending={navigation.state === "loading"} />;
}
