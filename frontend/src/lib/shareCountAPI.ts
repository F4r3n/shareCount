
export function getBackendURL(): string {
    const backendURL = import.meta.env.VITE_BACKEND_URL;
    if (!backendURL) {
        const params = new URLSearchParams(window.location.search);
		return params.get("url") ?? "";
    }
    return backendURL;
}

