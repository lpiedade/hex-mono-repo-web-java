import { useNavigation } from "react-router-dom";
import { useRouteTitle } from "../hooks/useDocumentTitle";
import { useColorMode } from "../theme/colorMode";
import { Shell } from "./Shell";

/**
 * The root route's element: the shell, fed from the color-mode context and from
 * the router's own state.
 *
 * `Shell` itself stays prop-driven, which keeps it renderable without a data
 * router — that is how its own suites mount it. What only a data router knows —
 * the matched routes' titles, whether a lazily loaded screen is still on its
 * way — is read here and handed down.
 */
export function ShellLayout() {
  const { colorMode, toggleColorMode } = useColorMode();
  const navigation = useNavigation();
  useRouteTitle();

  return (
    <Shell
      colorMode={colorMode}
      onToggleColorMode={toggleColorMode}
      pending={navigation.state === "loading"}
    />
  );
}
