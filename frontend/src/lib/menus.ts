export enum MENU {
    GROUPS = 0,
    EXPENSES = 1,
    BALANCES = 2,
    HISTORY = 3,
    TRANSACTION = 4
}

export interface MenuNavigation {
    type: MENU,
    name: string,
    return_path: string,
    path: string,
    display_tab: boolean
}

export const menus: MenuNavigation[] = [
    { type: MENU.GROUPS, name: "Groups", return_path: "", path: "/", display_tab: false },
    { type: MENU.EXPENSES, name: "Expenses", return_path: "/", path: "/expenses", display_tab: true },
    { type: MENU.BALANCES, name: "Balances", return_path: "/", path: "/balances", display_tab: true },
    { type: MENU.HISTORY, name: "History", return_path: "/", path: "/history", display_tab: true },
    { type: MENU.TRANSACTION, name: "Transaction", return_path: "/expenses", path: "/transaction", display_tab: false },

]

