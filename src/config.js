export const packages = {
  'frontend-core': {
    id: 'frontend-core',
    title: 'Frontend — Part 1: Core and shared foundation',
    branch: 'auto/frontend',
    roots: [
      'frontend/index.html', 'frontend/package.json', 'frontend/package-lock.json',
      'frontend/postcss.config.js', 'frontend/tailwind.config.js', 'frontend/tsconfig.json',
      'frontend/vite.config.ts', 'frontend/src/App.tsx', 'frontend/src/main.tsx',
      'frontend/src/index.css', 'frontend/src/context/', 'frontend/src/layouts/',
      'frontend/src/services/', 'frontend/src/types.ts'
    ],
    description: 'Application entry point, configuration, shared context, layouts, API services and types.'
  },
  'frontend-pages': {
    id: 'frontend-pages',
    title: 'Frontend — Part 2: Screens and components',
    branch: 'auto/frontend',
    roots: ['frontend/src/components/', 'frontend/src/pages/'],
    description: 'Reusable UI components and admin, staff, customer and authentication screens.'
  },
  backend: {
    id: 'backend',
    title: 'Backend',
    branch: 'auto/backend',
    roots: ['backend/'],
    description: 'Node.js, Express, Prisma, API modules, services, workers and backend tests.'
  },
  'cobol-database': {
    id: 'cobol-database',
    title: 'COBOL, database and project support',
    branch: 'auto/cobol-database',
    roots: ['cobol-engine/', 'database/', 'infrastructure/', 'docs/', 'scripts/', 'tests/',
            'package.json', 'package-lock.json', 'docker-compose.yml', '.dockerignore',
            '.gitignore', '.env.example'],
    description: 'COBOL financial engine, database, infrastructure, docs, scripts, tests and root project configuration.'
  }
};

export const allowedUsers = {
  'vikas-kumar-10': ['frontend-core', 'frontend-pages'],
  'sanjana-2306': ['backend'],
  'hem1234567': ['cobol-database']
};

export const target = {
  owner: process.env.TARGET_OWNER || 'Hem1234567',
  repo: process.env.TARGET_REPO || 'Odoo_Subscription_Management',
  sourceOwner: process.env.SOURCE_OWNER || 'Hem1234567',
  sourceRepo: process.env.SOURCE_REPO || 'odoo-demo',
  sourceRef: process.env.SOURCE_REF || 'main'
};

export function isPackagePath(pkg, filePath) {
  return pkg.roots.some(root => root.endsWith('/') ? filePath.startsWith(root) : filePath === root);
}
