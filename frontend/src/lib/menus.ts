export enum MENU {
    GROUPS = 0,
    EXPENSES = 1,
    BALANCES = 2,
}

interface MenuNavigation {
    type: MENU,
    name: string,
    need_group: boolean,
    path: string,
    depth: number,
}

export const menus: MenuNavigation[] = [
    { type: MENU.GROUPS,   depth: 0, name: "Groups", need_group: false, path: "/" },
    { type: MENU.EXPENSES, depth: 1, name: "Expenses", need_group: true, path: "/expenses" },
    { type: MENU.BALANCES, depth: 1, name: "Balances", need_group: true, path: "/balances" },
]

