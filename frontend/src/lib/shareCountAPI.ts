
const storage_name = "URL_BACKEND"

export function store_url(in_url : string) {
    localStorage.setItem(storage_name, in_url)
}

export function getBackendURL(): string {
    if(import.meta.env.VITE_BACKEND_URL)
        return import.meta.env.VITE_BACKEND_URL;
    // Without a configured or stored backend, assume the API is served
    // next to the frontend, under /api on the same host.
    return localStorage.getItem(storage_name) || `${window.location.host}/api`;
}

export function getFullBackendURL(): string {
    let url = import.meta.env.DEV ? "http://" : "https://"
    url += getBackendURL();
    return url;
}

