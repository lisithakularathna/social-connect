import { useState } from "react";
import api, { getErrorMessage } from "../api/api";
import { showGlobalToast } from "../utils/toast";

export type FollowState = "none" | "requested" | "following";

interface Props {
  userId: number;
  initialFollowing: boolean;
  /** A follow request to a private account is pending. */
  initialRequested?: boolean;
  /** They follow you — show "Follow back". */
  followsYou?: boolean;
  /** Called after the server confirms the change. */
  onChange?: (following: boolean, state?: FollowState) => void;
  size?: "sm" | "md";
}

function FollowButton({
  userId,
  initialFollowing,
  initialRequested = false,
  followsYou = false,
  onChange,
  size = "sm",
}: Props) {
  const [state, setState] = useState<FollowState>(
    initialFollowing ? "following" : initialRequested ? "requested" : "none"
  );
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    const previous = state;
    setBusy(true);
    try {
      if (previous === "none") {
        const { data } = await api.post(`/follows/${userId}`);
        const next: FollowState = data?.requested ? "requested" : "following";
        setState(next);
        if (next === "requested") showGlobalToast("Follow request sent");
        onChange?.(next === "following", next);
      } else {
        setState("none"); // optimistic
        await api.delete(`/follows/${userId}`);
        onChange?.(false, "none");
      }
    } catch (error) {
      setState(previous);
      showGlobalToast(getErrorMessage(error, "Couldn't update follow"));
    } finally {
      setBusy(false);
    }
  };

  const label =
    state === "following"
      ? hover
        ? "Unfollow"
        : "Following"
      : state === "requested"
        ? hover
          ? "Cancel"
          : "Requested"
        : followsYou
          ? "Follow back"
          : "Follow";

  return (
    <button
      type="button"
      className={`sc-follow-btn sc-follow-${size} ${state !== "none" ? "is-following" : ""} ${
        state === "requested" ? "is-requested" : ""
      }`}
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={busy}
      aria-pressed={state !== "none"}
    >
      {label}
    </button>
  );
}

export default FollowButton;
