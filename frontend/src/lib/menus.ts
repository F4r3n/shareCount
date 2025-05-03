export enum MENU {
    TRANSACTION = 0,
    STATISTICS = 1,
    GROUPS = 2
}



interface MenuNavigation {
    type: MENU,
    name: string,
    need_group: boolean
}

export const menus: MenuNavigation[] = [{ type: MENU.TRANSACTION, name: "Transactions", need_group:true }, 
    { type: MENU.STATISTICS, name: "Statistics",need_group:false }, 
    { type: MENU.GROUPS, name: "Groups",need_group:false }]

