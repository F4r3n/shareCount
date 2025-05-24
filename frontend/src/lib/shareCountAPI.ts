
const storage_name = "URL_BACKEND"

export function store_url(in_url : string) {
    localStorage.setItem(storage_name, in_url)
}

export function getBackendURL(): string {
    let url = import.meta.env.DEV ? "http://" : "https://"
    if(import.meta.env.VITE_BACKEND_URL)
        url += import.meta.env.VITE_BACKEND_URL;
    else {
        url += localStorage.getItem(storage_name)
    }
    return url;
}

