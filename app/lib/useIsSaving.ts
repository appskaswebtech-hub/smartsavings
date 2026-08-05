import { useNavigation } from "@remix-run/react";

/**
 * True from the moment a submit starts until the follow-up navigation — or the
 * loader revalidation an action triggers — has finished.
 *
 * `state === "submitting"` alone is not enough: it goes false the instant the
 * action returns, so the button re-enables while the page is still settling,
 * which flickers and leaves a window for a second submit.
 *
 * Testing `formMethod` rather than accepting every `"loading"` state keeps a
 * plain GET navigation — Discard, or a nav-menu link — from spinning the Save
 * button. Only a submission carries `formMethod`, and it stays set through the
 * loading phase that follows the action (see NavigationStates in
 * @remix-run/router: Loading has `formMethod` only when it follows a submit).
 */
export function useIsSaving(): boolean {
  const navigation = useNavigation();
  return navigation.state !== "idle" && navigation.formMethod != null;
}
