export const projectsTable = {
  name: 'projects',
  columns: {
    id: 'TEXT PRIMARY KEY',
    slug: 'TEXT NOT NULL UNIQUE',
    name: 'TEXT NOT NULL',
    description: 'TEXT',
    owner_user_id: 'TEXT NOT NULL',
    status: "TEXT NOT NULL DEFAULT 'active'",
    settings_json: 'TEXT',
    created_at: 'TEXT NOT NULL',
    updated_at: 'TEXT NOT NULL',
  },
} as const
