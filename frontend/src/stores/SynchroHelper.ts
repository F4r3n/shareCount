
/** The server answered with a non-2xx status. */
export class RemoteRequestError extends Error {
    constructor(public status: number) {
        super(`Request failed ${status}`);
        this.name = "RemoteRequestError";
    }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
        promise
            .then(result => {
                clearTimeout(timeout);
                resolve(result);
            })
            .catch(err => {
                clearTimeout(timeout);
                reject(err);
            });
    });
}