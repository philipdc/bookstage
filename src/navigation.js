export const navigationGroups = [
  {
    id: 'open',
    label: 'Open',
    items: [
      { path: '/', label: 'Start', screen: 'start' },
      { path: '/open', label: 'Open', screen: 'openWorkbench' },
      { path: '/help', label: 'Help', screen: 'helpLibrary' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { path: '/edit/debtors', label: 'Debtors', screen: 'masterList' },
      { path: '/edit/creditors', label: 'Creditors', screen: 'masterList' },
      { path: '/edit/accounts', label: 'Accounts', screen: 'accounts' },
      { path: '/edit/stock', label: 'Stock', screen: 'masterList' },
    ],
  },
  {
    id: 'input',
    label: 'Input',
    items: [
      { path: '/input/documents', label: 'Documents', screen: 'documents' },
      { path: '/input/bank', label: 'Bank', screen: 'bank' },
      { path: '/input/batch-entry', label: 'Batch Entry', screen: 'batchEntry' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { path: '/reports', label: 'Reports', screen: 'reports' },
    ],
  },
  {
    id: 'setup',
    label: 'Set up',
    items: [
      { path: '/setup/profile', label: 'Profile', screen: 'profile' },
      { path: '/setup/languages', label: 'Languages', screen: 'languages' },
      { path: '/setup/themes', label: 'Themes', screen: 'themes' },
      { path: '/setup/plugins', label: 'Plugins', screen: 'plugins' },
      { path: '/setup/switch-language', label: 'Switch Language', screen: 'switchLanguage' },
      { path: '/setup/registration', label: 'Online Registration', screen: 'registration' },
    ],
  },
];

export const routes = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label }))
);

export function getRoute(pathname) {
  return routes.find((route) => route.path === pathname) || routes[0];
}
