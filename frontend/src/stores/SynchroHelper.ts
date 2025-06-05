import { STATUS } from "../db/db";

export const Synchro = {
    compute_next_status(has_error: boolean, status : STATUS): STATUS {
        let nextStatus = STATUS.NOTHING;
        if (!has_error) {
            nextStatus = STATUS.NOTHING;
        }
        else if (has_error) {
            if (status === STATUS.TO_CREATE) {
                nextStatus = STATUS.TO_CREATE;
            }
            else {
                nextStatus = STATUS.TO_UPDATE;
            }
        }
        return nextStatus;
    }
};