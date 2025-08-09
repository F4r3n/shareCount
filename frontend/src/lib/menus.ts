export enum MENU {
    GROUPS = 0,
    EXPENSES = 1,
    BALANCES = 2,
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
    { type: MENU.BALANCES, name: "Transaction", return_path: "/expenses", path: "/transaction", display_tab: false },
    { type: MENU.BALANCES, name: "Group", return_path: "/", path: "/group", display_tab: false },
]

