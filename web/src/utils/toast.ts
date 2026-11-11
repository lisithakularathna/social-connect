// Global lightweight toast emitter and listener
type ToastListener = (msg: string) => void;
const listeners: Set<ToastListener> = new Set();

export function showGlobalToast(message: string) {
  listeners.forEach((listener) => {
    try {
      listener(message);
    } catch (e) {
      console.error("Toast listener error:", e);
    }
  });
  // Also dispatch window event for non-react listeners
  window.dispatchEvent(new CustomEvent("sc:global_toast", { detail: { message } }));
}

export function subscribeToGlobalToast(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
