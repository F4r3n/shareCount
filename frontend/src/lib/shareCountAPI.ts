
const storage_name = "URL_BACKEND"

export function store_url(in_url : string) {
    localStorage.setItem(storage_name, in_url)
}

export function getBackendURL() {
    if(import.meta.env.VITE_BACKEND_URL)
        return import.meta.env.VITE_BACKEND_URL;
    else {
        return localStorage.getItem(storage_name)
    }
}

export function getFullBackendURL(): string {
    let url = import.meta.env.DEV ? "http://" : "https://"
    url += getBackendURL();
    return url;
}

