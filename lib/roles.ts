export type AdminRole='Owner'|'Operations'|'Merchandising'|'Support'|'Analyst';

export const ADMIN_ROLES:AdminRole[]=['Owner','Operations','Merchandising','Support','Analyst'];

const permissions:Record<AdminRole,string[]>={
  Owner:['read','content','products','inventory','orders','customers','support','returns','promotions','reports','settings','access','delete','refund'],
  Operations:['read','orders','inventory','returns','support','customers','refund','reports'],
  Merchandising:['read','content','products','inventory','promotions','reports'],
  Support:['read','customers','orders','returns','support','reports'],
  Analyst:['read','reports'],
};

const actionPermission:Record<string,string>={
  adminContent:'content',
  adminSection:'content',
  adminSectionOrder:'content',
  adminSectionDelete:'content',
  adminSectionsReset:'content',
  adminCoupon:'promotions',
  adminDuplicateProduct:'products',
  adminProduct:'products',
  adminInventory:'inventory',
  adminDelete:'delete',
  adminRestoreProduct:'products',
  adminSettings:'settings',
  adminCustomer:'customers',
  adminOrder:'orders',
  adminFeedback:'support',
  adminLead:'support',
  adminSupport:'support',
  adminReturn:'returns',
  adminReview:'content',
  adminTeamSave:'access',
  adminTeamRemove:'access',
};

export function normalizeAdminRole(value:unknown):AdminRole{
  const v=String(value??'').trim();
  return (ADMIN_ROLES.includes(v as AdminRole)?v:'Owner') as AdminRole;
}
export function permissionForAction(action:string){return actionPermission[action]||'read';}
export function canAdmin(role:AdminRole,action:string){return permissions[role].includes(permissionForAction(action));}
export function rolePermissions(role:AdminRole){return [...permissions[role]];}
