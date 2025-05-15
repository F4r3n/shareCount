export enum MENU {
    EXPENSES = 0,
    BALANCES = 1,
    GROUPS = 2
}

interface MenuNavigation {
    type: MENU,
    name: string,
    need_group: boolean,
    path: string
}

export const menus: MenuNavigation[] = [
    { type: MENU.EXPENSES, name: "Expenses", need_group: true, path:"/expenses" },
    { type: MENU.BALANCES, name: "Balances", need_group: true , path:"/balances"},
    { type: MENU.GROUPS, name: "Groups", need_group: false , path:"/"}]

