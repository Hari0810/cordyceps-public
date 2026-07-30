export async function registerServiceWorker(appBuildId, onControllerChange) {
  if (!("serviceWorker" in navigator)) {
    return {
      serviceWorkerRegistration: null,
      pushSupported: false
    };
  }

  if (typeof onControllerChange === "function") {
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js", {
    updateViaCache: "none"
  });

  return {
    serviceWorkerRegistration,
    pushSupported: "PushManager" in window
  };
}

export async function syncPushSubscription(serviceWorkerRegistration, pushSupported) {
  if (!serviceWorkerRegistration || !pushSupported) {
    return null;
  }

  return serviceWorkerRegistration.pushManager.getSubscription();
}

export async function enablePushAlerts({
  serviceWorkerRegistration,
  pushSupported,
  pushConfig,
  apiFetch,
  showToast,
  subscribeEndpoint = "/api/push/subscribe",
}) {
  if (!serviceWorkerRegistration || !pushSupported) {
    return { pushSubscription: null, pushConfig };
  }

  if (isIosLikeDevice() && !isStandaloneApp()) {
    showToast("Install required", "On iPhone, Web Push only works after adding this app to the Home Screen.");
    return { pushSubscription: null, pushConfig };
  }

  if (Notification.permission === "denied") {
    showToast("Push blocked", "Allow notifications in your browser settings to enable web push.");
    return { pushSubscription: null, pushConfig };
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showToast("Permission needed", "Allow notifications to enable Web Push.");
      return { pushSubscription: null, pushConfig };
    }
  }

  const nextPushConfig = pushConfig || await apiFetch("/api/push/config");
  const pushSubscription = await serviceWorkerRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(nextPushConfig.publicKey)
  });

  await apiFetch(subscribeEndpoint, {
    method: "POST",
    body: JSON.stringify({ subscription: pushSubscription.toJSON() })
  });

  showToast("Push enabled", "Background alerts will now arrive through the service worker.");
  return { pushSubscription, pushConfig: nextPushConfig };
}

export async function disablePushAlerts(pushSubscription, apiFetch, showToast, unsubscribeEndpoint = "/api/push/unsubscribe") {
  if (!pushSubscription) {
    return null;
  }

  const endpoint = pushSubscription.endpoint;
  await pushSubscription.unsubscribe();
  await apiFetch(unsubscribeEndpoint, {
    method: "POST",
    body: JSON.stringify({ endpoint })
  });

  showToast("Push disabled", "Background push delivery has been turned off for this browser.");
  return null;
}

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosLikeDevice() {
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}
