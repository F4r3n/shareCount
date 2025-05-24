
const storage_name = "URL_BACKEND"

export function store_url(in_url : string) {
    localStorage.setItem(storage_name, in_url)
}

export function getBackendURL(): string {
    let url = import.meta.env.VITE_BACKEND_URL;
    if (!url) {
        url = localStorage.getItem(storage_name)
    }
    return url;
}

