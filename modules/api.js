export class ApiError extends Error {
  constructor(message, { status = null, payload = null, isNetworkError = false, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.isNetworkError = isNetworkError;
    this.cause = cause;
  }
}

export const AUTH_REQUIRED_EVENT = "city-auth:required";

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function apiFetch(url, options = {}) {
  let response;
  const requestOptions = {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  };

  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    throw new ApiError("Network request failed", { isNetworkError: true, cause: error });
  }

  if (response.status === 401) {
    try {
      await delay(150);
      response = await fetch(url, requestOptions);
    } catch (error) {
      throw new ApiError("Network request failed", { isNetworkError: true, cause: error });
    }
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, {
        detail: {
          status: 401,
          url
        }
      }));
    }

    throw new ApiError(`Request failed with status ${response.status}`, {
      status: response.status,
      payload
    });
  }

  return response.json();
}
