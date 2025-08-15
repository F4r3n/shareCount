
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